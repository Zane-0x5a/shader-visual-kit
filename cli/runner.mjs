import spawn from 'cross-spawn';

// Do not launch host code until the parent has assigned this runner to its job.
process.once('disconnect', () => process.exit(1));
process.once('message', ({command, args, project}) => {
  const child = spawn(command, args, {cwd: project, stdio: 'inherit', windowsHide: true});
  child.once('error', error => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  });
  child.once('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
});
