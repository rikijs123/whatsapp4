const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

(async ()=>{
  const base = process.env.BASE_URL || 'http://localhost:3000';
  console.log('Running smoke tests against', base);

  try {
    // Admin login
    const loginRes = await fetch(base + '/admin/login', {
      method: 'POST', headers: {'content-type':'application/json'},
      body: JSON.stringify({ username: 'rikijspilka', password: 'pilkarikijs' })
    });
    const loginJson = await loginRes.json();
    if (!loginJson.token) throw new Error('admin login failed: ' + JSON.stringify(loginJson));
    console.log('Admin login OK');

    // fetch rooms
    const roomsRes = await fetch(base + '/admin/rooms', { headers: { 'Authorization': 'Bearer ' + loginJson.token } });
    if (roomsRes.status !== 200) throw new Error('rooms fetch failed: ' + roomsRes.status);
    console.log('Admin rooms fetch OK');

    console.log('SMOKE TESTS PASSED');
    process.exit(0);
  } catch (e) {
    console.error('SMOKE TESTS FAILED', e.message || e);
    process.exit(2);
  }
})();
