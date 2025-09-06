const express = require('express');
const cors = require('cors');
const config = require('./config');
const reservationsRouter = require('./routes/reservations');
const parkingRouter = require('./routes/parking');

const app = express();
const PORT = config.port;

app.use(cors());
app.use(express.json());

app.get('/api/config', (req, res) => {
  res.json({
    allowedEmailDomain: config.allowedEmailDomain
  });
});

app.use('/api/reservations', reservationsRouter);
app.use('/api/parking-spots', parkingRouter);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

module.exports = app;
