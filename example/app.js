// example/app.js
import '../index.js';
import './modulink_setup.js';
import app from './server.js';

app.listen(3000, () => console.log('Server running on port 3000'));
