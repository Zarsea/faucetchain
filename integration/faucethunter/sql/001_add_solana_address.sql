-- FaucetHunter × FaucetChain — a única mudança de schema da integração.
--
-- Opcional para o usuário: quem deixar em branco continua usando a FaucetHunter
-- exatamente como usa hoje, e a ponte não faz nada para essa pessoa.
--
-- MySQL 8 não tem ADD COLUMN IF NOT EXISTS. Rodar duas vezes devolve
-- "Duplicate column name 'solana_address'" e não faz mal nenhum.
--
-- 44 caracteres é o maior endereço Solana possível (32 bytes em base58).
-- Os 50 dão folga para espaço colado junto sem estourar a coluna.

ALTER TABLE `fh_users`
  ADD COLUMN `solana_address` VARCHAR(50) DEFAULT NULL AFTER `faucetpay_address`;


-- Conferência, depois de rodar:
--
--   SHOW COLUMNS FROM `fh_users` LIKE 'solana_address';
--
-- E, antes de decidir o que fazer com o login sem senha (ver PATCHES.md):
--
--   SELECT COUNT(*) FROM `fh_users` WHERE password_hash IS NULL OR password_hash = '';
