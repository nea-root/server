import { GraphQLScalarType, Kind } from 'graphql';
import { authResolvers } from './src/resolvers/auth.resolver.js';
import { profileResolvers } from './src/resolvers/profile.resolver.js';
import { documentResolvers } from './src/resolvers/document.resolver.js';
import { availabilityResolvers } from './src/resolvers/availability.resolver.js';
import { appointmentResolvers } from './src/resolvers/appointment.resolver.js';
import { chatResolvers } from './src/resolvers/chat.resolver.js';
import { paymentResolvers } from './src/resolvers/payment.resolver.js';
import { notificationResolvers } from './src/resolvers/notification.resolver.js';
import { sosResolvers } from './src/resolvers/sos.resolver.js';
import { reviewResolvers } from './src/resolvers/review.resolver.js';
import { awarenessResolvers } from './src/resolvers/awareness.resolver.js';

const DateScalar = new GraphQLScalarType({
  name: 'Date',
  description: 'ISO-8601 date/datetime scalar',
  serialize: (value) => (value instanceof Date ? value.toISOString() : String(value)),
  parseValue: (value) => new Date(value),
  parseLiteral: (ast) => (ast.kind === Kind.STRING ? new Date(ast.value) : null),
});

const mergeResolvers = (...maps) => {
  const result = { Query: {}, Mutation: {} };
  for (const map of maps) {
    if (map.Query) Object.assign(result.Query, map.Query);
    if (map.Mutation) Object.assign(result.Mutation, map.Mutation);
    for (const [key, val] of Object.entries(map)) {
      if (key !== 'Query' && key !== 'Mutation') result[key] = val;
    }
  }
  return result;
};

export const resolvers = {
  Date: DateScalar,
  ...mergeResolvers(
    authResolvers,
    profileResolvers,
    documentResolvers,
    availabilityResolvers,
    appointmentResolvers,
    chatResolvers,
    paymentResolvers,
    notificationResolvers,
    sosResolvers,
    reviewResolvers,
    awarenessResolvers,
  ),
};
