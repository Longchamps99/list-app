const { getServerSession } = require('next-auth');
const { authOptions } = require('./lib/auth.ts');

async function checkSession() {
    console.log('=== Checking Session ===\n');

    try {
        const session = await getServerSession(authOptions);

        if (!session) {
            console.log('❌ No session found - user not logged in');
            return;
        }

        console.log('✅ Session exists');
        console.log('User:', JSON.stringify(session.user, null, 2));
        console.log('\nUser ID:', session.user?.id || 'MISSING!');
        console.log('User Email:', session.user?.email);

    } catch (error) {
        console.error('Error:', error);
    }
}

checkSession();
