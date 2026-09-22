// Refuse to run write tests against the production Site, even with TEST_ORIGIN set.
const origin=new URL(process.env.TEST_ORIGIN||'http://localhost:5173');
if(!['localhost','127.0.0.1','[::1]'].includes(origin.hostname))throw new Error('Write tests require a loopback TEST_ORIGIN. Production is read-only.');
