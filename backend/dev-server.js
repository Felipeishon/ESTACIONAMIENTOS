process.env.NODE_ENV = 'development';
const app = require('./index');
const config = require('./config');

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
