async function testWorkspaceCreation() {
  try {
    const response = await fetch('http://localhost:5000/api/v1/workspaces', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Test Workspace',
        slug: 'test-workspace',
        description: 'A test workspace',
        timezone: 'UTC',
        industry: 'Technology'
      })
    });

    console.log('Status:', response.status);
    
    const text = await response.text();
    console.log('Response:', text);
    
    if (response.ok) {
      console.log('✅ Workspace creation successful!');
    } else {
      console.log('❌ Workspace creation failed');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testWorkspaceCreation();