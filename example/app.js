// example/app.js
require('modulink-js');
require('./modulink_setup');
const app = require('./server');

app.listen(3000, () => console.log('Server running on port 3000'));
