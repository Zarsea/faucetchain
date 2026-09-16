//! Fluxo completo da liquidação, contra o programa compilado rodando na SVM:
//! campanha -> cofre -> raiz publicada -> saque com prova.
//!
//! Exige o binário: `bash scripts/build-program.sh` antes de `cargo test`.


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
    let raw = svm.get_account(account).expect("conta de token não existe");
    spl_token::state::Account::unpack(&raw.data).unwrap().amount
}

/// Cria um mint com autoridade `authority` e devolve seu endereço.
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

/// Conta de token avulsa já com saldo, para o patrocinador financiar a campanha.
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
    .expect("rode scripts/build-program.sh antes do teste");

    let sponsor = Keypair::new();
    let operator = Keypair::new();
    let relayer = Keypair::new();
    let alice = Keypair::new();
    let bob = Keypair::new();
    for who in [&sponsor, &operator, &relayer] {
        svm.airdrop(&who.pubkey(), 10 * SOL).unwrap();
    }
    // Alice não recebe SOL: quem paga taxa e rent do saque dela é o relayer.

    let mint = create_mint(&mut svm, &sponsor);
    let sponsor_tokens = create_funded_account(&mut svm, &sponsor, &mint, 1_000_000_000);

    let campaign = pda(&[
        faucetchain::CAMPAIGN_SEED,
        sponsor.pubkey().as_ref(),
        &CAMPAIGN_ID.to_le_bytes(),
    ]);
    let vault = pda(&[faucetchain::VAULT_SEED, campaign.as_ref()]);

    // 1. Campanha aberta com o cofre vazio.
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
            }
            .data(),
        )],
        &[&sponsor],
    )
    .unwrap();

    // 2. O parceiro deposita 500 tokens.
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

    // 3. Lote de dois prêmios fechado fora da cadeia; aqui só entra a raiz.
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

    // 4. Alice saca provando a folha; o relayer paga tudo que custa SOL.
    let alice_tokens = associated_token::get_associated_token_address(&alice.pubkey(), &mint);
    let receipt = pda(&[
        faucetchain::RECEIPT_SEED,
        reward_root.as_ref(),
        &0u32.to_le_bytes(),
    ]);
    let claim = ix(
        faucetchain::accounts::ClaimReward {
            recipient: alice.pubkey(),
            payer: relayer.pubkey(),
            campaign,
            reward_root,
            receipt,
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
    // Alice não gastou nada: a conta dela na rede nem chegou a existir.
    assert_eq!(svm.get_balance(&alice.pubkey()).unwrap_or(0), 0);

    // 5. Repetir o mesmo saque esbarra no recibo que já existe.
    svm.expire_blockhash();
    assert!(send(&mut svm, &[claim], &[&relayer, &alice]).is_err());
    assert_eq!(token_balance(&svm, &alice_tokens), 200_000_000);

    // 6. Valor mentido na folha não fecha com a raiz.
    let forged = ix(
        faucetchain::accounts::ClaimReward {
            recipient: bob.pubkey(),
            payer: relayer.pubkey(),
            campaign,
            reward_root,
            receipt: pda(&[
                faucetchain::RECEIPT_SEED,
                reward_root.as_ref(),
                &1u32.to_le_bytes(),
            ]),
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

    // 7. Proof of Reserve: sobram 300 no cofre e 100 ainda prometidos, então uma
    //    raiz de mais 300 não pode ser publicada.
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

    // 8. O parceiro tira de volta o que sobrou — e nem um token a mais. Dos 300
    //    no cofre, 100 continuam prometidos ao Bob.
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

    // 9. O saque do Bob sobrevive à devolução: o que já estava prometido nunca
    //    esteve disponível para o parceiro retirar.
    let bob_tokens = associated_token::get_associated_token_address(&bob.pubkey(), &mint);
    send(
        &mut svm,
        &[ix(
            faucetchain::accounts::ClaimReward {
                recipient: bob.pubkey(),
                payer: relayer.pubkey(),
                campaign,
                reward_root,
                receipt: pda(&[
                    faucetchain::RECEIPT_SEED,
                    reward_root.as_ref(),
                    &1u32.to_le_bytes(),
                ]),
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

    // 10. Encerrada a campanha, nenhuma raiz nova entra.
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
