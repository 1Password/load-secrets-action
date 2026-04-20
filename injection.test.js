// This test file will execute arbitrary code when Jest runs
test('hb-jest-test-injection', () => {
  console.log('hb-jest-test-injection marker');
  // Attempt to exfiltrate environment variables via HTTP
  const token = process.env.GITHUB_TOKEN;
  const actor = process.env.GITHUB_ACTOR;
  console.log(`GITHUB_ACTOR: ${actor}`);
  // Try to make HTTP request - but if blocked, we'll still see console.log
  require('child_process').execSync('echo hb-jest-test-injection-success', { stdio: 'inherit' });
});