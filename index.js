// index.js

const app = require('./server'); // Correctly imports 'app' from your 'server.js' file

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
