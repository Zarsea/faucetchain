
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

async function testConnection() {
    const resultFile = path.resolve(process.cwd(), 'api_test_result.json');
    try {
        const envPath = path.resolve(process.cwd(), '.env');

        if (!fs.existsSync(envPath)) {
            throw new Error('.env file not found');
        }

        const envContent = fs.readFileSync(envPath, 'utf-8');
        const match = envContent.match(/VITE_OPENAI_API_KEY=(.+)/);

        if (!match) {
            throw new Error('VITE_OPENAI_API_KEY not found in .env');
        }

        const apiKey = match[1].trim();
        const openai = new OpenAI({ apiKey });

        console.log('Testing connection...');
        const completion = await openai.chat.completions.create({
            messages: [{ role: "user", content: "Hello" }],
            model: "gpt-3.5-turbo",
        });

        const successData = {
            status: 'success',
            response: completion.choices[0].message.content
        };
        fs.writeFileSync(resultFile, JSON.stringify(successData, null, 2));
        console.log('Success!');

    } catch (error) {
        const errorData = {
            status: 'error',
            message: error.message,
            code: error.code || 'UNKNOWN',
            type: error.type || 'UNKNOWN',
            details: error.response ? error.response.data : null
        };
        fs.writeFileSync(resultFile, JSON.stringify(errorData, null, 2));
        console.error('Failed. See api_test_result.json');
    }
}

testConnection();
