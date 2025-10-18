const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static('public'));

const queue = [];
const pairs = new Map();

io.on('connection', (socket) => {
  console.log('connect', socket.id);

  socket.on('join', (info = {}) => {
    console.log('join', socket.id, info.mode || 'video');
    // naive queue: pair first waiting with next
    if (queue.length && queue[0] !== socket.id) {
      const partnerId = queue.shift();
      const room = partnerId + '#' + socket.id;
      pairs.set(socket.id, partnerId);
      pairs.set(partnerId, socket.id);
      socket.emit('paired', { partnerId });
      socket.to(partnerId).emit('paired', { partnerId: socket.id });
      console.log('paired', partnerId, '<->', socket.id);
    } else {
      queue.push(socket.id);
      socket.emit('waiting');
      console.log('queued', socket.id);
    }
  });

  socket.on('remote-ready', () => {
    // no-op placeholder
  });

  socket.on('offer', (m) => {
    const to = pairs.get(socket.id);
    if (to) io.to(to).emit('offer', m);
  });

  socket.on('answer', (m) => {
    const to = pairs.get(socket.id);
    if (to) io.to(to).emit('answer', m);
  });

  socket.on('ice-candidate', (m) => {
    const to = pairs.get(socket.id);
    if (to) io.to(to).emit('ice-candidate', m);
  });

  socket.on('message', (m) => {
    const to = pairs.get(socket.id);
    if (to) io.to(to).emit('message', m);
  });

  socket.on('next', () => {
    const partner = pairs.get(socket.id);
    if (partner) {
      io.to(partner).emit('partner-disconnected');
      pairs.delete(partner);
      pairs.delete(socket.id);
    }
    // put socket back in queue
    if (!queue.includes(socket.id)) queue.push(socket.id);
  });

  socket.on('leave', () => {
    const partner = pairs.get(socket.id);
    if (partner) {
      io.to(partner).emit('partner-disconnected');
      pairs.delete(partner);
      pairs.delete(socket.id);
    }
  });

  socket.on('disconnect', () => {
    console.log('disconnect', socket.id);
    // remove from queue
    const qi = queue.indexOf(socket.id);
    if (qi !== -1) queue.splice(qi, 1);
    const partner = pairs.get(socket.id);
    if (partner) {
      io.to(partner).emit('partner-disconnected');
      pairs.delete(partner);
      pairs.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Server listening on', PORT));
