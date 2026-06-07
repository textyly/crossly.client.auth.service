import { createApp } from './createApp.js';
import { JwtSigner } from './signer/jwtSigner.js';

const port = 4000;
// HS256 shared secret. MUST be overridden via AUTH_JWT_SECRET in any real environment.
const secret = process.env.AUTH_JWT_SECRET ?? 'dev-only-insecure-secret-change-me';

// Entry point: build the signer, build the app via the shared factory, and listen.
const signer = new JwtSigner(secret);
const app = createApp(signer);

app.listen(port, () => {
    console.log(`crossly.client.auth.service listening on port ${port}`);
});

export default app;
