"""
Gate-02 launcher: reads session-env.txt without shell quoting interpretation,
then spawns the acceptance harness with correct credentials in the environment.
"""
import os
import sys
import subprocess

SESSION_ENV = 'qa-artifacts/real-auth/qa-final-acceptance-realapi-01/session-env.txt'

env = dict(os.environ)
with open(SESSION_ENV, encoding='utf-8') as f:
    for raw in f:
        line = raw.rstrip('\n')
        if not line or line.startswith('#'):
            continue
        eq = line.index('=')
        key = line[:eq]
        val = line[eq + 1:]
        env[key] = val

env['STRIDETO_QA_BASE'] = 'https://localhost:5443'
env['STRIDETO_QA_RESOLVER_DIR'] = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'qa-artifacts', 'real-auth', 'qa-final-acceptance-realapi-01')
env.setdefault('STRIDETO_QA_STAGE_TIMEOUT_MS', '120000')

passthrough = [arg for arg in sys.argv[1:] if arg != '--resume']
has_run_id = any(arg.startswith('--run-id=') for arg in passthrough)
args = [
    'node', 'scripts/pre-freeze-final-acceptance-harness.mjs',
    '--full',
    '--theme=explicit-light',
    '--width=1440',
]
if not has_run_id:
    raise SystemExit('Refusing to launch without an explicit --run-id= (frozen run must not be resumed)')
args.extend(passthrough)

result = subprocess.run(
    args,
    env=env,
    cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
)
sys.exit(result.returncode)
