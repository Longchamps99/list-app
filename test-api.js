// Simple test to call the items API directly
fetch('http://localhost:3000/api/items')
    .then(res => {
        console.log('Status:', res.status);
        return res.text();
    })
    .then(text => {
        console.log('Response:', text);
        try {
            const json = JSON.parse(text);
            console.log('Parsed JSON:', json);
        } catch (e) {
            console.log('Not JSON, raw text:', text);
        }
    })
    .catch(err => console.error('Error:', err));
