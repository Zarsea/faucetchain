import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { autonomousCodeGeneration } from './services/geminiService.js';

// Load env vars
dotenv.config();

const ROOT_DIR = process.cwd();
const ERRORS_DIR = path.join(ROOT_DIR, 'error_reports');
const FIXES_DIR = path.join(ROOT_DIR, 'sentinel-fixes');

// Ensure directories exist
if (!fs.existsSync(ERRORS_DIR)) fs.mkdirSync(ERRORS_DIR, { recursive: true });
if (!fs.existsSync(FIXES_DIR)) fs.mkdirSync(FIXES_DIR, { recursive: true });

console.log("👁️  Sentinel Watchdog Node iniciado.");
console.log("Monitorando erros em: ", ERRORS_DIR);

/**
 * Função principal do loop Watchdog
 */
async function watchAndFix() {
    try {
        const files = fs.readdirSync(ERRORS_DIR);
        const logFiles = files.filter(f => f.endsWith('.log'));
        
        if (logFiles.length === 0) {
            console.log("✔️  Rede estável. Nenhum erro detectado.");
            return;
        }

        for (const file of logFiles) {
            console.log(`\n🚨 Anomalia detectada: [${file}]`);
            console.log(`🧠 Acionando Sentinel AI (gemini-3-pro-preview) para auto-cura...`);
            
            const filePath = path.join(ERRORS_DIR, file);
            const errorLog = fs.readFileSync(filePath, 'utf8');
            
            // Generate a synthetic file context for the AI
            // In a real scenario, the error log would point to a real file, which we'd read.
            const syntheticContext = `
// Contexto do erro:
// Função calculatePoS estava causando overflow.
function calculatePoS(stake) {
    return stake * 999999999999999999;
}
            `;

            console.log("⏳ Sintetizando patch de código...");
            const patchCode = await autonomousCodeGeneration(
                errorLog, 
                syntheticContext,
                "Reescreva a função 'calculatePoS' usando BigInt adequadamente e previna o overflow reportado."
            );
            
            // Save the patch
            const patchName = file.replace('.log', '_patch.js');
            const patchPath = path.join(FIXES_DIR, patchName);
            
            fs.writeFileSync(patchPath, typeof patchCode === 'string' ? patchCode : JSON.stringify(patchCode));
            console.log(`✅ Patch gerado com sucesso! Arquivo salvo em: ${patchPath}`);
            
            // Move original log to prevent recursion
            fs.renameSync(filePath, path.join(ERRORS_DIR, file.replace('.log', '.resolved_log')));
        }
    } catch (error) {
        console.error("❌ Falha no Watchdog:", error);
    }
}

// Executar uma vez no boot (Para demonstração)
watchAndFix();

// Descomentar para rodar o loop contínuo:
// setInterval(watchAndFix, 30000);
