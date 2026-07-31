// Pin the timezone before Jest spawns workers.
//
// The driver app renders wall-clock times in the DEVICE's local zone, and every
// driver and job is in Malaysia. Tests that exercise date formatting therefore
// have to agree on a zone or they pass on one machine and fail on CI.
//
// This has to be globalSetup, not setupFilesAfterEach: Node caches the zone on
// first Date use, so setting TZ inside a test file is already too late. Workers
// inherit this env.
module.exports = async () => {
  process.env.TZ = 'Asia/Kuala_Lumpur';
};
