const testRegistration = async () => {
  const url = 'http://localhost:5000/api/v1/auth/register';
  const body = {
    email: 'runtime1@test.com',
    password: 'TestPass123!',
    firstName: 'Run',
    lastName: 'Time'
  };

  console.log('> POST', url);
  console.log('> Content-Type: application/json');
  console.log('> Body:', JSON.stringify(body, null, 2));
  console.log('');

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    console.log('< HTTP Status:', response.status, response.statusText);
    console.log('< Headers:');
    response.headers.forEach((value, key) => {
      console.log(`<   ${key}: ${value}`);
    });
    console.log('');

    const data = await response.json();
    console.log('< Response Body:');
    console.log(JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log('\n✅ Registration successful!');
    } else {
      console.log('\n❌ Registration failed!');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
};

testRegistration();
