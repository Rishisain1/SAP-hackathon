import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const rootDir = process.cwd();

export function hasPythonModels() {
  if (process.env.ENABLE_PYTHON_MODELS === 'false') return false;
  const modelDir = path.resolve(rootDir, process.env.MODEL_DIR ?? './models');
  return (
    fs.existsSync(path.join(modelDir, 'defective_model.pkl')) &&
    fs.existsSync(path.join(modelDir, 'delay_model.pkl'))
  );
}

export async function runPythonModels(input, weather, distanceKm) {
  if (!hasPythonModels()) return null;

  const scriptPath = path.join(rootDir, 'scripts', 'infer_models.py');
  if (!fs.existsSync(scriptPath)) return null;

  const payload = JSON.stringify({ input, weather, distanceKm });

  return new Promise((resolve) => {
    const child = spawn('python', [scriptPath], {
      cwd: rootDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env }
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('close', (code) => {
      if (code !== 0) {
        console.warn(`Python model bridge failed: ${stderr}`);
        resolve(null);
        return;
      }

      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        console.warn(`Python model bridge returned invalid JSON: ${error.message}`);
        resolve(null);
      }
    });

    child.stdin.write(payload);
    child.stdin.end();
  });
}
