//! The whole settlement flow, against the compiled program running on the SVM:
//! campaign -> vault -> published root -> withdrawal with a proof.
//!
//! Needs the binary: run `bash scripts/build-program.sh` before `cargo test`.


use anchor_lang::{
    prelude::{AccountMeta, Pubkey},
    solana_program::{
        instruction::Instruction, program_pack::Pack, system_instruction, system_program,
    },
    InstructionData, ToAccountMetas,
};
use anchor_spl::{associated_token, token::spl_token};
use faucetchain::merkle::leaf_hash;
use litesvm::{types::TransactionResult, LiteSVM};
use solana_keccak_hasher::hashv;
use solana_keypair::Keypair;
use solana_signer::Signer;
use solana_transaction::Transaction;

const SOL: u64 = 1_000_000_000;
const DECIMALS: u8 = 6;
const CAMPAIGN_ID: u64 = 42;

fn send(svm: &mut LiteSVM, ixs: &[Instruction], signers: &[&Keypair]) -> TransactionResult {
    let tx = Transaction::new_signed_with_payer(
        ixs,
        Some(&signers[0].pubkey()),
        signers,
        svm.latest_blockhash(),
    );
    svm.send_transaction(tx)
}

fn token_balance(svm: &LiteSVM, account: &Pubkey) -> u64 {
    let raw = svm.get_account(account).expect("token account does not exist");
    spl_token::state::Account::unpack(&raw.data).unwrap().amount
}

/// Creates a mint owned by `authority` and returns its address.
fn create_mint(svm: &mut LiteSVM, authority: &Keypair) -> Pubkey {
    let mint = Keypair::new();
    let rent = svm.minimum_balance_for_rent_exemption(spl_token::state::Mint::LEN);
    let ixs = [
        system_instruction::create_account(
            &authority.pubkey(),
            &mint.pubkey(),
            rent,
            spl_token::state::Mint::LEN as u64,
            &spl_token::ID,
        ),
        spl_token::instruction::initialize_mint(
            &spl_token::ID,
            &mint.pubkey(),
            &authority.pubkey(),
            None,
            DECIMALS,
        )
        .unwrap(),
    ];
    send(svm, &ixs, &[authority, &mint]).unwrap();
    mint.pubkey()
}

/// A standalone token account with a balance, for the sponsor to fund with.
fn create_funded_account(
    svm: &mut LiteSVM,
    authority: &Keypair,
    mint: &Pubkey,
    amount: u64,
) -> Pubkey {
    let account = Keypair::new();
    let rent = svm.minimum_balance_for_rent_exemption(spl_token::state::Account::LEN);
    let ixs = [
        system_instruction::create_account(
            &authority.pubkey(),
            &account.pubkey(),
            rent,
            spl_token::state::Account::LEN as u64,
            &spl_token::ID,
        ),
        spl_token::instruction::initialize_account3(
            &spl_token::ID,
            &account.pubkey(),
            mint,
            &authority.pubkey(),
        )
        .unwrap(),
        spl_token::instruction::mint_to(
            &spl_token::ID,
            mint,
            &account.pubkey(),
            &authority.pubkey(),
            &[],
            amount,
        )
        .unwrap(),
    ];
    send(svm, &ixs, &[authority, &account]).unwrap();
    account.pubkey()
}

fn pda(seeds: &[&[u8]]) -> Pubkey {
    Pubkey::find_program_address(seeds, &faucetchain::ID).0
}

fn ix(accounts: Vec<AccountMeta>, data: Vec<u8>) -> Instruction {
    Instruction {
        program_id: faucetchain::ID,
        accounts,
        data,
    }
}

#[test]
fn campaign_pays_only_what_the_published_root_proves() {
    let mut svm = LiteSVM::new();
    svm.add_program_from_file(
        faucetchain::ID,
        concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../target/deploy/faucetchain.so"
        ),
    )
    .expect("run scripts/build-program.sh before the test");

    let sponsor = Keypair::new();
    let operator = Keypair::new();
    let relayer = Keypair::new();
    let alice = Keypair::new();
    let bob = Keypair::new();
    for who in [&sponsor, &operator, &relayer] {
        svm.airdrop(&who.pubkey(), 10 * SOL).unwrap();
    }
    // Alice gets no SOL: the relayer pays the fee and the rent of her withdrawal.

    let mint = create_mint(&mut svm, &sponsor);
    let sponsor_tokens = create_funded_account(&mut svm, &sponsor, &mint, 1_000_000_000);

    let campaign = pda(&[
        faucetchain::CAMPAIGN_SEED,
        sponsor.pubkey().as_ref(),
        &CAMPAIGN_ID.to_le_bytes(),
    ]);
    let vault = pda(&[faucetchain::VAULT_SEED, campaign.as_ref()]);

    // 1. The campaign opens with an empty vault.
    send(
        &mut svm,
        &[ix(
            faucetchain::accounts::CreateCampaign {
                sponsor: sponsor.pubkey(),
                campaign,
                mint,
                vault,
                token_program: spl_token::ID,
                system_program: system_program::ID,
            }
            .to_account_metas(None),
            faucetchain::instruction::CreateCampaign {
                campaign_id: CAMPAIGN_ID,
                operator: operator.pubkey(),
                // 400 a period against a 500 vault: room for the honest root
                // below, and a ceiling the last step can walk into.
                period_cap: 400_000_000,
                period_len: 30 * 86_400,
            }
            .data(),
        )],
        &[&sponsor],
    )
    .unwrap();

    // 2. The partner deposits 500 tokens.
    send(
        &mut svm,
        &[ix(
            faucetchain::accounts::FundCampaign {
                sponsor: sponsor.pubkey(),
                campaign,
                mint,
                sponsor_token_account: sponsor_tokens,
                vault,
                token_program: spl_token::ID,
            }
            .to_account_metas(None),
            faucetchain::instruction::FundCampaign {
                amount: 500_000_000,
            }
            .data(),
        )],
        &[&sponsor],
    )
    .unwrap();
    assert_eq!(token_balance(&svm, &vault), 500_000_000);

    // 3. A two-reward batch closed off-chain; only its root comes in here.
    let leaf_alice = leaf_hash(&alice.pubkey(), 200_000_000, 0);
    let leaf_bob = leaf_hash(&bob.pubkey(), 100_000_000, 1);
    let root = hashv(&[&leaf_alice, &leaf_bob]).to_bytes();
    let reward_root = pda(&[
        faucetchain::ROOT_SEED,
        campaign.as_ref(),
        &0u32.to_le_bytes(),
    ]);

    let publish = |index: u32, root: [u8; 32], total: u64, root_pda: Pubkey| {
        ix(
            faucetchain::accounts::PublishRoot {
                operator: operator.pubkey(),
                campaign,
                reward_root: root_pda,
                vault,
                system_program: system_program::ID,
            }
            .to_account_metas(None),
            faucetchain::instruction::PublishRoot {
                index,
                root,
                total_amount: total,
                leaf_count: 2,
            }
            .data(),
        )
    };
    send(
        &mut svm,
        &[publish(0, root, 300_000_000, reward_root)],
        &[&operator],
    )
    .unwrap();

    // 4. Alice withdraws by proving her leaf; the relayer pays everything that costs SOL.
    let alice_tokens = associated_token::get_associated_token_address(&alice.pubkey(), &mint);
    let claim = ix(
        faucetchain::accounts::ClaimReward {
            recipient: alice.pubkey(),
            payer: relayer.pubkey(),
            campaign,
            reward_root,
            mint,
            vault,
            recipient_token_account: alice_tokens,
            token_program: spl_token::ID,
            associated_token_program: associated_token::ID,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
        faucetchain::instruction::ClaimReward {
            leaf_index: 0,
            amount: 200_000_000,
            proof: vec![leaf_bob],
        }
        .data(),
    );
    send(&mut svm, &[claim.clone()], &[&relayer, &alice]).unwrap();
    assert_eq!(token_balance(&svm, &alice_tokens), 200_000_000);
    assert_eq!(token_balance(&svm, &vault), 300_000_000);
    // Alice spent nothing: her account on the network never even came to exist.
    assert_eq!(svm.get_balance(&alice.pubkey()).unwrap_or(0), 0);

    // 5. Repeating the same withdrawal runs into the bit already set for that leaf.
    svm.expire_blockhash();
    let err = send(&mut svm, &[claim], &[&relayer, &alice]).unwrap_err();
    assert!(
        err.meta.logs.iter().any(|l| l.contains("AlreadyClaimed")),
        "{:?}",
        err.meta.logs
    );
    assert_eq!(token_balance(&svm, &alice_tokens), 200_000_000);

    // 6. A lie about the amount in the leaf does not add up to the root.
    let forged = ix(
        faucetchain::accounts::ClaimReward {
            recipient: bob.pubkey(),
            payer: relayer.pubkey(),
            campaign,
            reward_root,
            mint,
            vault,
            recipient_token_account: associated_token::get_associated_token_address(
                &bob.pubkey(),
                &mint,
            ),
            token_program: spl_token::ID,
            associated_token_program: associated_token::ID,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
        faucetchain::instruction::ClaimReward {
            leaf_index: 1,
            amount: 999_000_000,
            proof: vec![leaf_alice],
        }
        .data(),
    );
    let err = send(&mut svm, &[forged], &[&relayer, &bob]).unwrap_err();
    assert!(
        err.meta.logs.iter().any(|l| l.contains("InvalidProof")),
        "{:?}",
        err.meta.logs
    );

    // 7. Proof of reserve: 300 left in the vault and 100 still promised, so a
    //    root for another 300 cannot be published.
    let second_root = pda(&[
        faucetchain::ROOT_SEED,
        campaign.as_ref(),
        &1u32.to_le_bytes(),
    ]);
    let err = send(
        &mut svm,
        &[publish(1, [9u8; 32], 300_000_000, second_root)],
        &[&operator],
    )
    .unwrap_err();
    assert!(
        err.meta
            .logs
            .iter()
            .any(|l| l.contains("InsufficientReserve")),
        "{:?}",
        err.meta.logs
    );

    // 7a. The period ceiling: the vault could cover another 100, and the reserve
    //     check would pass, but the sponsor allowed 400 a period and 300 is
    //     already promised. This is what bounds a compromised sequencer to one
    //     period instead of the whole budget.
    let third_root = pda(&[
        faucetchain::ROOT_SEED,
        campaign.as_ref(),
        &3u32.to_le_bytes(),
    ]);
    let err = send(
        &mut svm,
        &[publish(3, [8u8; 32], 100_000_001, third_root)],
        &[&operator],
    )
    .unwrap_err();
    assert!(
        err.meta.logs.iter().any(|l| l.contains("PeriodCapExceeded")),
        "{:?}",
        err.meta.logs
    );

    // 7b. A batch bigger than a root can hold is refused at the door. The cap is
    //     what keeps the bitmap inside the size limit for an account created
    //     through a CPI; a busier campaign closes more batches instead.
    let oversized = ix(
        faucetchain::accounts::PublishRoot {
            operator: operator.pubkey(),
            campaign,
            reward_root: pda(&[
                faucetchain::ROOT_SEED,
                campaign.as_ref(),
                &2u32.to_le_bytes(),
            ]),
            vault,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
        faucetchain::instruction::PublishRoot {
            index: 2,
            root: [7u8; 32],
            total_amount: 1,
            leaf_count: faucetchain::MAX_LEAVES_PER_BATCH + 1,
        }
        .data(),
    );
    let err = send(&mut svm, &[oversized], &[&operator]).unwrap_err();
    assert!(
        err.meta.logs.iter().any(|l| l.contains("BatchTooLarge")),
        "{:?}",
        err.meta.logs
    );

    // 8. The partner takes back the surplus, and not one token more. Of the 300
    //    in the vault, 100 are still promised to Bob.
    let withdraw = |amount: u64| {
        ix(
            faucetchain::accounts::WithdrawSurplus {
                sponsor: sponsor.pubkey(),
                campaign,
                mint,
                sponsor_token_account: sponsor_tokens,
                vault,
                token_program: spl_token::ID,
            }
            .to_account_metas(None),
            faucetchain::instruction::WithdrawSurplus { amount }.data(),
        )
    };
    let err = send(&mut svm, &[withdraw(200_000_001)], &[&sponsor]).unwrap_err();
    assert!(
        err.meta
            .logs
            .iter()
            .any(|l| l.contains("InsufficientReserve")),
        "{:?}",
        err.meta.logs
    );
    send(&mut svm, &[withdraw(200_000_000)], &[&sponsor]).unwrap();
    assert_eq!(token_balance(&svm, &vault), 100_000_000);
    assert_eq!(token_balance(&svm, &sponsor_tokens), 700_000_000);

    // 9. Bob's withdrawal survives the refund: what was already promised was
    //    never available for the partner to take.
    let bob_tokens = associated_token::get_associated_token_address(&bob.pubkey(), &mint);
    send(
        &mut svm,
        &[ix(
            faucetchain::accounts::ClaimReward {
                recipient: bob.pubkey(),
                payer: relayer.pubkey(),
                campaign,
                reward_root,
                mint,
                vault,
                recipient_token_account: bob_tokens,
                token_program: spl_token::ID,
                associated_token_program: associated_token::ID,
                system_program: system_program::ID,
            }
            .to_account_metas(None),
            faucetchain::instruction::ClaimReward {
                leaf_index: 1,
                amount: 100_000_000,
                proof: vec![leaf_alice],
            }
            .data(),
        )],
        &[&relayer, &bob],
    )
    .unwrap();
    assert_eq!(token_balance(&svm, &bob_tokens), 100_000_000);
    assert_eq!(token_balance(&svm, &vault), 0);

    // 10. Once the campaign is closed, no new root gets in.
    let close = ix(
        faucetchain::accounts::CloseCampaign {
            sponsor: sponsor.pubkey(),
            campaign,
        }
        .to_account_metas(None),
        faucetchain::instruction::CloseCampaign {}.data(),
    );
    send(&mut svm, &[close.clone()], &[&sponsor]).unwrap();
    let err = send(
        &mut svm,
        &[publish(1, [9u8; 32], 1, second_root)],
        &[&operator],
    )
    .unwrap_err();
    assert!(
        err.meta.logs.iter().any(|l| l.contains("CampaignClosed")),
        "{:?}",
        err.meta.logs
    );
    svm.expire_blockhash();
    assert!(send(&mut svm, &[close], &[&sponsor]).is_err());
}


/// Token-2022 is refused at the door, so a transfer fee can never reach a leaf.
///
/// TokenInterface accepts both token programs, and a Token-2022 mint may carry
/// a TransferFee extension. The vault would be debited exactly what the leaf
/// published while the recipient received less than that -- and the leaf is the
/// promise the whole program exists to keep. A root that pays 98 where it said
/// 100 is not rounding; it is the guarantee failing without saying so.
///
/// The vault is created under whichever token program opened the campaign and
/// never changes program afterwards, so refusing here is enough: no Token-2022
/// mint can reach claim_reward.
#[test]
fn a_campaign_cannot_open_under_token_2022() {
    let mut svm = LiteSVM::new();
    svm.add_program_from_file(
        faucetchain::ID,
        concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../target/deploy/faucetchain.so"
        ),
    )
    .expect("run scripts/build-program.sh before the test");

    // The well-known Token-2022 program id, written out rather than pulled in
    // as a dependency for one constant.
    let token_2022: Pubkey = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        .parse()
        .unwrap();

    let sponsor = Keypair::new();
    svm.airdrop(&sponsor.pubkey(), 10 * SOL).unwrap();
    let mint = create_mint(&mut svm, &sponsor);

    let campaign = pda(&[
        faucetchain::CAMPAIGN_SEED,
        sponsor.pubkey().as_ref(),
        &CAMPAIGN_ID.to_le_bytes(),
    ]);
    let vault = pda(&[faucetchain::VAULT_SEED, campaign.as_ref()]);

    let result = send(
        &mut svm,
        &[ix(
            faucetchain::accounts::CreateCampaign {
                sponsor: sponsor.pubkey(),
                campaign,
                mint,
                vault,
                token_program: token_2022,
                system_program: system_program::ID,
            }
            .to_account_metas(None),
            faucetchain::instruction::CreateCampaign {
                campaign_id: CAMPAIGN_ID,
                operator: sponsor.pubkey(),
                period_cap: 0,
                period_len: 0,
            }
            .data(),
        )],
        &[&sponsor],
    );
    assert!(
        result.is_err(),
        "a campaign opened under Token-2022; a transfer fee would then be able          to deliver less than a published leaf promises"
    );

    // And the classic program still opens one, so the constraint refuses the
    // right thing rather than everything.
    send(
        &mut svm,
        &[ix(
            faucetchain::accounts::CreateCampaign {
                sponsor: sponsor.pubkey(),
                campaign,
                mint,
                vault,
                token_program: spl_token::ID,
                system_program: system_program::ID,
            }
            .to_account_metas(None),
            faucetchain::instruction::CreateCampaign {
                campaign_id: CAMPAIGN_ID,
                operator: sponsor.pubkey(),
                period_cap: 0,
                period_len: 0,
            }
            .data(),
        )],
        &[&sponsor],
    )
    .unwrap();
}
