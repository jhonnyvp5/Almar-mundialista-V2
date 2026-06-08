(async () => {
    const res = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cedula: '123', correo: 'test@test.com' })
    });
    const text = await res.text();
    console.log(res.status, text);
})();
