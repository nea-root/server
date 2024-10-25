import { ApolloServer } from '@apollo/server';
import { expressMiddleware as apolloMiddleware } from '@apollo/server/express4';
import createError from 'http-errors';
import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import { resolvers } from './resolvers.js';
import { readFile } from 'node:fs/promises';
import cors from 'cors';
import indexRouter from './routes/index.js';
import usersRouter from './routes/users.js';

const PORT = 9000;
const __dirname = path.resolve(); // To get the current directory in ES6 modules
const app = express();

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(cors(), express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// GraphQL endpoint
const typeDefs = await readFile('./schema.graphql', 'utf8');
const apolloServer = new ApolloServer({ typeDefs, resolvers });
await apolloServer.start();
app.use('/graphql', apolloMiddleware(apolloServer));

// Routers
app.use('/', indexRouter);
app.use('/users', usersRouter);

// Catch 404 and forward to error handler
app.use((req, res, next) => {
  next(createError(404));
});

// Error handler
app.use((err, req, res, next) => {
  // Set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // Render the error page
  res.status(err.status || 500);
  res.render('error');
});

// // Start the server
// app.listen({ port: PORT }, () => {
//   console.log(`Server running on port ${PORT}`);
//   console.log(`GraphQL endpoint running on http://localhost:${PORT}/graphql/`);
// });

export default app;
