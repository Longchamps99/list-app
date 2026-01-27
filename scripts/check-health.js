
const urls = [
    'http://localhost:3000/api/items',
    'http://localhost:3000/api/lists',
    'http://localhost:3000/opengraph-image'
];

async function check() {
    for (const url of urls) {
        try {
            const start = Date.now();
            const res = await fetch(url);
            const end = Date.now();
            console.log(`[${res.status}] ${url} (${end - start}ms)`);
            if (res.status === 500) {
                const text = await res.text();
                console.log(`   ERROR: ${text.slice(0, 200)}`);
            }
        } catch (e) {
            console.log(`[FAIL] ${url}: ${e.message}`);
        }
    }
}

check();
