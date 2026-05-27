const path = require('path');
const { fork } = require('child_process');

let activeWorker;
let lastQueuedAt = 0;

const queueJobRefresh = (profile = {}, reason = 'manual', options = {}) => {
  if (activeWorker && !activeWorker.killed) {
    return {
      queued: false,
      status: 'already_running',
      pid: activeWorker.pid,
      reason,
    };
  }

  lastQueuedAt = Date.now();
  const workerPath = path.join(__dirname, '..', 'workers', 'jobRefreshWorker.js');
  const worker = fork(workerPath, [], {
    cwd: path.join(__dirname, '..'),
    detached: false,
    stdio: 'inherit',
    env: {
      ...process.env,
      JOB_REFRESH_PROFILE: JSON.stringify(profile || {}),
      JOB_REFRESH_REASON: reason,
      JOB_REFRESH_REEMBED_EXISTING: options.reembedExisting === false ? 'false' : 'true',
    },
  });

  activeWorker = worker;
  worker.once('exit', () => {
    if (activeWorker === worker) {
      activeWorker = undefined;
    }
  });

  return {
    queued: true,
    status: 'started',
    pid: worker.pid,
    reason,
    queuedAt: new Date(lastQueuedAt).toISOString(),
  };
};

const getJobRefreshStatus = () => ({
  running: Boolean(activeWorker && !activeWorker.killed),
  pid: activeWorker?.pid || null,
  lastQueuedAt: lastQueuedAt ? new Date(lastQueuedAt).toISOString() : null,
});

module.exports = { queueJobRefresh, getJobRefreshStatus };
