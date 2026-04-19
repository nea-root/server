/**
 * OpenAPI 3.0 specification for Nevereveralone REST endpoints.
 * The primary API surface is GraphQL at /graphql — this document covers
 * the supplementary REST endpoints (file upload, health, webhook) plus
 * a full reference of every GraphQL operation rendered as virtual paths
 * so consumers have one place to browse the whole API.
 */

const swaggerDefinition = {
  openapi: '3.0.3',
  info: {
    title: 'Nevereveralone API',
    version: '1.0.0',
    description: `
## Overview

**Nevereveralone** is a domestic-violence support platform connecting victims with
lawyers, therapists, and volunteers.

### API architecture

| Surface | URL | Notes |
|---------|-----|-------|
| GraphQL | \`POST /graphql\` | Primary API — all business logic |
| File upload | \`POST /upload\` | Multipart REST endpoint |
| Health check | \`GET /health\` | Load-balancer probe |
| Stripe webhook | \`POST /stripe/webhook\` | Raw-body Stripe event handler |

### Authentication

All GraphQL operations (except \`register\`, \`login\`, \`forgotPassword\`,
\`resendVerification\`, \`verifyEmail\`, \`verifyResetCode\`, \`resetPassword\`,
\`articles\`, \`article\`) require a Bearer JWT in the **Authorization** header.

\`\`\`
Authorization: Bearer <accessToken>
\`\`\`

Access tokens expire in **15 minutes**. Use \`refreshToken\` mutation to rotate.

### User roles

| Role | Description |
|------|-------------|
| \`victim\` | Person seeking support |
| \`volunteer\` | Community support volunteer |
| \`lawyer\` | Legal professional |
| \`therapist\` | Mental-health professional |
| \`admin\` | Platform administrator |
    `,
    contact: {
      name: 'Nevereveralone Support',
      email: 'varunrachakatla0708@gmail.com',
    },
    license: {
      name: 'Private',
    },
  },
  servers: [
    {
      url: 'http://localhost:9000',
      description: 'Local development',
    },
    {
      url: 'https://api.nevereveralone.com',
      description: 'Production',
    },
  ],
  tags: [
    { name: 'Health', description: 'Service availability' },
    { name: 'Upload', description: 'File upload REST endpoint' },
    { name: 'Stripe', description: 'Payment webhook' },
    { name: 'GraphQL — Auth', description: 'Registration, login, password management' },
    { name: 'GraphQL — Profile', description: 'User profiles and professional listings' },
    { name: 'GraphQL — Documents', description: 'Evidence and verification documents' },
    { name: 'GraphQL — Availability', description: 'Professional scheduling' },
    { name: 'GraphQL — Appointments', description: 'Booking and appointment management' },
    { name: 'GraphQL — Chat', description: 'Real-time messaging' },
    { name: 'GraphQL — Payments', description: 'Stripe payment intents and subscriptions' },
    { name: 'GraphQL — Notifications', description: 'In-app notification centre' },
    { name: 'GraphQL — SOS', description: 'Emergency SOS events' },
    { name: 'GraphQL — Reviews', description: 'Professional reviews' },
    { name: 'GraphQL — Awareness', description: 'Public awareness articles' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Access token obtained from `login` or `refreshToken` mutation',
      },
    },
    schemas: {
      // ─── Generic payloads ───────────────────────────────────────────────────
      MessagePayload: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Operation successful' },
        },
        required: ['success', 'message'],
      },
      ErrorPayload: {
        type: 'object',
        properties: {
          errors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                message: { type: 'string' },
                extensions: {
                  type: 'object',
                  properties: {
                    code: {
                      type: 'string',
                      enum: [
                        'UNAUTHENTICATED',
                        'FORBIDDEN',
                        'NOT_FOUND',
                        'BAD_USER_INPUT',
                        'INTERNAL_SERVER_ERROR',
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      },

      // ─── User ──────────────────────────────────────────────────────────────
      UserRole: {
        type: 'string',
        enum: ['victim', 'volunteer', 'lawyer', 'therapist', 'admin'],
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '6650a1b2c3d4e5f6a7b8c9d0' },
          email: { type: 'string', format: 'email', example: 'alice@example.com' },
          role: { $ref: '#/components/schemas/UserRole' },
          firstName: { type: 'string', example: 'Alice' },
          lastName: { type: 'string', example: 'Smith' },
          phone: { type: 'string', example: '+447911123456' },
          isAnonymous: { type: 'boolean', example: false },
          anonymousAlias: { type: 'string', example: 'User1a2b3c', nullable: true },
          isEmailVerified: { type: 'boolean', example: true },
          isDocumentVerified: { type: 'boolean', example: false },
          isProfileComplete: { type: 'boolean', example: true },
          isActive: { type: 'boolean', example: true },
          country: { type: 'string', example: 'GB' },
          region: { type: 'string', example: 'England' },
          lastLoginAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      AuthPayload: {
        type: 'object',
        properties: {
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' },
          user: { $ref: '#/components/schemas/User' },
        },
        required: ['accessToken', 'refreshToken', 'user'],
      },
      TokenPayload: {
        type: 'object',
        properties: {
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' },
        },
        required: ['accessToken', 'refreshToken'],
      },
      RegisterPayload: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
          message: { type: 'string' },
        },
      },
      ResetTokenPayload: {
        type: 'object',
        properties: {
          resetToken: { type: 'string' },
        },
      },

      // ─── Profile ──────────────────────────────────────────────────────────
      Profile: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          user: { $ref: '#/components/schemas/User' },
          bio: { type: 'string', nullable: true },
          avatar: { type: 'string', format: 'uri', nullable: true },
          dateOfBirth: { type: 'string', format: 'date', nullable: true },
          gender: {
            type: 'string',
            enum: ['male', 'female', 'non_binary', 'prefer_not_to_say'],
            nullable: true,
          },
          languages: { type: 'array', items: { type: 'string' } },
          professionalTitle: { type: 'string', nullable: true },
          specializations: { type: 'array', items: { type: 'string' } },
          yearsOfExperience: { type: 'integer', nullable: true },
          licenseNumber: { type: 'string', nullable: true },
          barRegistrationNumber: { type: 'string', nullable: true },
          qualifications: { type: 'array', items: { type: 'string' } },
          hourlyRate: { type: 'number', format: 'float', nullable: true },
          currency: { type: 'string', enum: ['USD', 'GBP', 'INR'], example: 'GBP' },
          areasServed: { type: 'array', items: { type: 'string' } },
          averageRating: { type: 'number', format: 'float', example: 4.7 },
          totalReviews: { type: 'integer', example: 23 },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },

      // ─── Document ─────────────────────────────────────────────────────────
      DocumentStatus: {
        type: 'string',
        enum: ['pending', 'verified', 'rejected'],
      },
      DocumentNote: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          content: { type: 'string' },
          addedBy: { $ref: '#/components/schemas/User' },
          isStarred: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Document: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          owner: { $ref: '#/components/schemas/User' },
          type: {
            type: 'string',
            enum: ['evidence', 'identity', 'legal', 'medical', 'other'],
          },
          title: { type: 'string' },
          description: { type: 'string', nullable: true },
          fileUrl: { type: 'string', format: 'uri' },
          fileName: { type: 'string' },
          fileSize: { type: 'integer', nullable: true },
          mimeType: { type: 'string', nullable: true },
          verificationStatus: { $ref: '#/components/schemas/DocumentStatus' },
          notes: { type: 'array', items: { $ref: '#/components/schemas/DocumentNote' } },
          isSharedWithProfessional: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },

      // ─── Availability ─────────────────────────────────────────────────────
      WeeklyInterval: {
        type: 'object',
        properties: {
          dayOfWeek: { type: 'integer', minimum: 0, maximum: 6, description: '0=Sun … 6=Sat' },
          startTime: { type: 'string', example: '09:00' },
          endTime: { type: 'string', example: '17:00' },
        },
      },
      TimeSlot: {
        type: 'object',
        properties: {
          startTime: { type: 'string', format: 'date-time' },
          endTime: { type: 'string', format: 'date-time' },
        },
      },
      Availability: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          professional: { $ref: '#/components/schemas/User' },
          timezone: { type: 'string', example: 'Europe/London' },
          weeklyIntervals: {
            type: 'array',
            items: { $ref: '#/components/schemas/WeeklyInterval' },
          },
          sessionDurationMinutes: { type: 'integer', enum: [30, 45, 60, 90], example: 60 },
          isAcceptingClients: { type: 'boolean' },
        },
      },

      // ─── Appointment ──────────────────────────────────────────────────────
      AppointmentStatus: {
        type: 'string',
        enum: ['pending', 'confirmed', 'cancelled', 'completed', 'no_show'],
      },
      Appointment: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          client: { $ref: '#/components/schemas/User' },
          professional: { $ref: '#/components/schemas/User' },
          professionalType: { type: 'string', enum: ['lawyer', 'therapist', 'volunteer'] },
          startTime: { type: 'string', format: 'date-time' },
          endTime: { type: 'string', format: 'date-time' },
          durationMinutes: { type: 'integer' },
          status: { $ref: '#/components/schemas/AppointmentStatus' },
          notes: { type: 'string', nullable: true },
          cancelReason: { type: 'string', nullable: true },
          meetingRoomId: { type: 'string' },
          amountCharged: { type: 'number', nullable: true },
          currency: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },

      // ─── Chat ─────────────────────────────────────────────────────────────
      ChatMessage: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          chat: { type: 'string' },
          sender: { $ref: '#/components/schemas/User' },
          content: { type: 'string' },
          type: { type: 'string', enum: ['text', 'image', 'file', 'system'] },
          isRead: { type: 'boolean' },
          isDeleted: { type: 'boolean' },
          senderAlias: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Chat: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          participants: { type: 'array', items: { $ref: '#/components/schemas/User' } },
          type: { type: 'string', enum: ['direct', 'anonymous_support'] },
          lastMessage: { $ref: '#/components/schemas/ChatMessage', nullable: true },
          unreadCount: { type: 'integer' },
          isActive: { type: 'boolean' },
          lastMessageAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },

      // ─── Payment ──────────────────────────────────────────────────────────
      Payment: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          payer: { $ref: '#/components/schemas/User' },
          amount: { type: 'number' },
          currency: { type: 'string' },
          status: {
            type: 'string',
            enum: ['pending', 'succeeded', 'failed', 'refunded'],
          },
          type: { type: 'string', enum: ['appointment', 'subscription'] },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      PaymentIntentPayload: {
        type: 'object',
        properties: {
          clientSecret: { type: 'string' },
          paymentId: { type: 'string' },
        },
      },
      SubscriptionType: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          plan: { type: 'string', enum: ['basic', 'premium'] },
          status: { type: 'string', enum: ['active', 'cancelled', 'past_due'] },
          currentPeriodStart: { type: 'string', format: 'date-time' },
          currentPeriodEnd: { type: 'string', format: 'date-time' },
          cancelAtPeriodEnd: { type: 'boolean' },
          currency: { type: 'string' },
        },
      },
      SubscriptionPayload: {
        type: 'object',
        properties: {
          subscription: { $ref: '#/components/schemas/SubscriptionType' },
          clientSecret: { type: 'string' },
        },
      },

      // ─── Notification ─────────────────────────────────────────────────────
      Notification: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: {
            type: 'string',
            enum: [
              'appointment_booked',
              'appointment_confirmed',
              'appointment_cancelled',
              'appointment_reminder',
              'appointment_rescheduled',
              'document_verified',
              'document_rejected',
              'new_message',
              'sos_triggered',
              'sos_resolved',
              'payment_succeeded',
              'payment_failed',
              'profile_reviewed',
              'subscription_renewed',
              'system',
            ],
          },
          title: { type: 'string' },
          body: { type: 'string' },
          isRead: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      NotificationsPayload: {
        type: 'object',
        properties: {
          notifications: {
            type: 'array',
            items: { $ref: '#/components/schemas/Notification' },
          },
          unreadCount: { type: 'integer' },
        },
      },

      // ─── SOS ──────────────────────────────────────────────────────────────
      SosEvent: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          triggeredBy: { $ref: '#/components/schemas/User' },
          status: { type: 'string', enum: ['triggered', 'responded', 'resolved'] },
          location: {
            type: 'object',
            properties: {
              type: { type: 'string', example: 'Point' },
              coordinates: {
                type: 'array',
                items: { type: 'number' },
                example: [-0.1278, 51.5074],
                description: '[longitude, latitude]',
              },
            },
          },
          notes: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      SosPayload: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          event: { $ref: '#/components/schemas/SosEvent' },
          emergencyNumber: { type: 'string', example: '999' },
        },
      },

      // ─── Review ───────────────────────────────────────────────────────────
      Review: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          professional: { $ref: '#/components/schemas/User' },
          reviewer: { $ref: '#/components/schemas/User', nullable: true },
          rating: { type: 'integer', minimum: 1, maximum: 5 },
          comment: { type: 'string', nullable: true },
          isAnonymous: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },

      // ─── Awareness ────────────────────────────────────────────────────────
      AwarenessArticle: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          slug: { type: 'string', example: 'know-your-rights' },
          content: { type: 'string' },
          excerpt: { type: 'string', nullable: true },
          category: { type: 'string', nullable: true },
          tags: { type: 'array', items: { type: 'string' } },
          author: { $ref: '#/components/schemas/User', nullable: true },
          isPublished: { type: 'boolean' },
          viewCount: { type: 'integer' },
          publishedAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },

      // ─── REST-specific ────────────────────────────────────────────────────
      UploadResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          url: { type: 'string', example: '/uploads/a1b2c3d4.pdf' },
          fileName: { type: 'string', example: 'evidence.pdf' },
        },
      },
      HealthResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'ok' },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },

      // ─── GraphQL envelope ─────────────────────────────────────────────────
      GraphQLRequest: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string', description: 'GraphQL query or mutation string' },
          variables: {
            type: 'object',
            additionalProperties: true,
            description: 'Variable values keyed by name',
          },
          operationName: {
            type: 'string',
            description: 'Operation name (required when sending multiple operations)',
            nullable: true,
          },
        },
      },
      GraphQLResponse: {
        type: 'object',
        properties: {
          data: { type: 'object', additionalProperties: true, nullable: true },
          errors: {
            type: 'array',
            items: { $ref: '#/components/schemas/ErrorPayload' },
            nullable: true,
          },
        },
      },
    },

    // ─── Reusable parameters ───────────────────────────────────────────────────
    parameters: {
      PageParam: {
        name: 'page',
        in: 'query',
        schema: { type: 'integer', default: 1, minimum: 1 },
        description: 'Page number (1-based)',
      },
      LimitParam: {
        name: 'limit',
        in: 'query',
        schema: { type: 'integer', default: 20, minimum: 1, maximum: 100 },
        description: 'Results per page',
      },
    },

    // ─── Reusable responses ────────────────────────────────────────────────────
    responses: {
      Unauthenticated: {
        description: 'Missing or invalid JWT',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/GraphQLResponse' },
            example: {
              errors: [{ message: 'Not authenticated', extensions: { code: 'UNAUTHENTICATED' } }],
            },
          },
        },
      },
      Forbidden: {
        description: 'Insufficient role or ownership',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/GraphQLResponse' },
            example: {
              errors: [{ message: 'Forbidden', extensions: { code: 'FORBIDDEN' } }],
            },
          },
        },
      },
      NotFound: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/GraphQLResponse' },
            example: {
              errors: [{ message: 'Not found', extensions: { code: 'NOT_FOUND' } }],
            },
          },
        },
      },
    },
  },

  paths: {
    // ─── REST: Health ──────────────────────────────────────────────────────────
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        description: 'Returns `ok` when the server is running. Used by load balancers.',
        security: [],
        responses: {
          200: {
            description: 'Service healthy',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthResponse' },
              },
            },
          },
        },
      },
    },

    // ─── REST: Upload ──────────────────────────────────────────────────────────
    '/upload': {
      post: {
        tags: ['Upload'],
        summary: 'Upload a file',
        description:
          'Accepts a single file (multipart/form-data). Returns the public URL to store in a Document record via the GraphQL `addDocument` mutation.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: {
                  file: {
                    type: 'string',
                    format: 'binary',
                    description: 'File to upload (max 10 MB)',
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'File uploaded',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UploadResponse' },
              },
            },
          },
          400: {
            description: 'No file provided',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    message: { type: 'string', example: 'No file' },
                  },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthenticated' },
        },
      },
    },

    // ─── REST: Stripe webhook ──────────────────────────────────────────────────
    '/stripe/webhook': {
      post: {
        tags: ['Stripe'],
        summary: 'Stripe webhook receiver',
        description:
          'Receives signed events from Stripe. Must be called with the raw request body (not JSON-parsed). Configure this URL in your Stripe dashboard.',
        security: [],
        parameters: [
          {
            name: 'stripe-signature',
            in: 'header',
            required: true,
            schema: { type: 'string' },
            description: 'HMAC signature provided by Stripe',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                description: 'Raw Stripe event payload',
                properties: {
                  type: {
                    type: 'string',
                    enum: [
                      'payment_intent.succeeded',
                      'payment_intent.payment_failed',
                      'customer.subscription.deleted',
                    ],
                  },
                  data: { type: 'object', additionalProperties: true },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Event acknowledged',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { received: { type: 'boolean', example: true } },
                },
              },
            },
          },
          400: {
            description: 'Invalid signature or payload',
          },
        },
      },
    },

    // ─── GraphQL endpoint ─────────────────────────────────────────────────────
    '/graphql': {
      post: {
        tags: ['GraphQL — Auth'],
        summary: 'GraphQL endpoint',
        description:
          'All GraphQL operations are sent to this endpoint. The tag on each example operation indicates the domain.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/GraphQLRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'GraphQL response (errors are inside the response body, not HTTP status)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GraphQLResponse' },
              },
            },
          },
        },
      },
    },

    // ── Virtual paths — one per GraphQL operation so Swagger shows them ────────

    '/graphql/auth/register': {
      post: {
        tags: ['GraphQL — Auth'],
        summary: 'mutation register',
        description: 'Create a new account. Returns `userId` and sends an email verification code.',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/GraphQLRequest' },
                  {
                    example: {
                      query: `mutation Register($email: String!, $password: String!, $role: UserRole!) {
  register(email: $email, password: $password, role: $role) {
    userId
    message
  }
}`,
                      variables: {
                        email: 'alice@example.com',
                        password: 'securePass123!',
                        role: 'victim',
                      },
                    },
                  },
                ],
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Account created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: { register: { $ref: '#/components/schemas/RegisterPayload' } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    '/graphql/auth/verifyEmail': {
      post: {
        tags: ['GraphQL — Auth'],
        summary: 'mutation verifyEmail',
        description: 'Verify email address with the 6-digit OTP sent during registration.',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              example: {
                query:
                  'mutation { verifyEmail(userId: "USER_ID", code: "123456") { success message } }',
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Email verified',
            content: {
              'application/json': {
                example: {
                  data: { verifyEmail: { success: true, message: 'Email verified successfully' } },
                },
              },
            },
          },
        },
      },
    },

    '/graphql/auth/login': {
      post: {
        tags: ['GraphQL — Auth'],
        summary: 'mutation login',
        description:
          'Authenticate and receive access + refresh tokens. Access tokens expire in 15 minutes.',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              example: {
                query:
                  'mutation { login(email: "alice@example.com", password: "securePass123!") { accessToken refreshToken user { id email role } } }',
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Authenticated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: { login: { $ref: '#/components/schemas/AuthPayload' } },
                    },
                  },
                },
              },
            },
          },
          200.1: { description: 'Invalid credentials → GraphQL errors array' },
        },
      },
    },

    '/graphql/auth/refreshToken': {
      post: {
        tags: ['GraphQL — Auth'],
        summary: 'mutation refreshToken',
        description: 'Exchange a valid refresh token for a new access/refresh token pair.',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              example: {
                query:
                  'mutation { refreshToken(refreshToken: "REFRESH_TOKEN") { accessToken refreshToken } }',
              },
            },
          },
        },
        responses: {
          200: {
            description: 'New token pair',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: { refreshToken: { $ref: '#/components/schemas/TokenPayload' } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    '/graphql/auth/forgotPassword': {
      post: {
        tags: ['GraphQL — Auth'],
        summary: 'mutation forgotPassword',
        description:
          'Send a password-reset OTP to the given email. Always returns success to prevent user enumeration.',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              example: {
                query:
                  'mutation { forgotPassword(email: "alice@example.com") { success message } }',
              },
            },
          },
        },
        responses: {
          200: { description: 'Email sent (or silently ignored if address not found)' },
        },
      },
    },

    '/graphql/auth/resetPassword': {
      post: {
        tags: ['GraphQL — Auth'],
        summary: 'mutation verifyResetCode + mutation resetPassword',
        description:
          '**Step 1** `verifyResetCode` — exchange the OTP for a one-time `resetToken`.\n\n**Step 2** `resetPassword` — set a new password using the `resetToken`.',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              examples: {
                step1: {
                  summary: 'Step 1 — verify OTP',
                  value: {
                    query:
                      'mutation { verifyResetCode(email: "alice@example.com", code: "123456") { resetToken } }',
                  },
                },
                step2: {
                  summary: 'Step 2 — set new password',
                  value: {
                    query:
                      'mutation { resetPassword(email: "alice@example.com", resetToken: "TOKEN", newPassword: "newPass123!") { success message } }',
                  },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Password reset or reset token issued' } },
      },
    },

    '/graphql/profile/me': {
      post: {
        tags: ['GraphQL — Profile'],
        summary: 'query me + query myProfile',
        description: 'Retrieve the authenticated user and their profile.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              example: {
                query:
                  '{ me { id email role } myProfile { bio avatar averageRating totalReviews } }',
              },
            },
          },
        },
        responses: {
          200: { description: 'User and profile returned' },
          401: { $ref: '#/components/responses/Unauthenticated' },
        },
      },
    },

    '/graphql/profile/professionals': {
      post: {
        tags: ['GraphQL — Profile'],
        summary: 'query professionals',
        description:
          'Browse verified professionals. Filterable by role, specialization, country, and minimum rating.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              example: {
                query:
                  '{ professionals(role: lawyer, country: "GB", minRating: 4.0) { id bio professionalTitle averageRating } }',
              },
            },
          },
        },
        responses: { 200: { description: 'Profile list' } },
      },
    },

    '/graphql/profile/updateProfile': {
      post: {
        tags: ['GraphQL — Profile'],
        summary: 'mutation updateProfile',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              example: {
                query:
                  'mutation($input: UpdateProfileInput!) { updateProfile(input: $input) { id bio } }',
                variables: {
                  input: { bio: 'Experienced family lawyer', hourlyRate: 150, currency: 'GBP' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Updated profile' },
          401: { $ref: '#/components/responses/Unauthenticated' },
        },
      },
    },

    '/graphql/documents': {
      post: {
        tags: ['GraphQL — Documents'],
        summary: 'query myDocuments · query document · mutations',
        description:
          'Manage evidence and identity documents.\n\n| Operation | Who | Description |\n|-----------|-----|-------------|\n| `myDocuments(type?)` | Owner | List own documents |\n| `document(id)` | Owner / shared | Fetch one document |\n| `addDocumentNote` | Owner | Add a note |\n| `toggleNoteStarred` | Owner | Star/unstar a note |\n| `shareDocument` | Owner | Share with a professional |\n| `deleteDocument` | Owner | Soft-delete |\n| `verifyDocument` | Admin | Set verification status |',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              example: {
                query: '{ myDocuments { id title type verificationStatus fileUrl } }',
              },
            },
          },
        },
        responses: { 200: { description: 'Documents' } },
      },
    },

    '/graphql/availability': {
      post: {
        tags: ['GraphQL — Availability'],
        summary: 'query availability · query availableSlots · mutations',
        description:
          'Manage professional availability windows and retrieve open booking slots.\n\n| Operation | Who | Description |\n|-----------|-----|-------------|\n| `availability(professionalId)` | Any auth | Fetch weekly schedule |\n| `availableSlots(professionalId, date)` | Any auth | List free slots for a date |\n| `upsertAvailability(…)` | Professional | Create/update schedule |\n| `scheduleAbsence(startDate, endDate)` | Professional | Block out dates |',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              example: {
                query:
                  '{ availableSlots(professionalId: "PROF_ID", date: "2026-06-15") { startTime endTime } }',
              },
            },
          },
        },
        responses: { 200: { description: 'Slots list' } },
      },
    },

    '/graphql/appointments': {
      post: {
        tags: ['GraphQL — Appointments'],
        summary: 'query appointments · mutations',
        description:
          'Book and manage appointments.\n\n| Operation | Who | Description |\n|-----------|-----|-------------|\n| `appointments(status?, view?)` | Client or Professional | List appointments |\n| `appointment(id)` | Participant | Fetch one |\n| `bookAppointment(…)` | Victim | Book a slot |\n| `confirmAppointment(id)` | Professional | Accept booking |\n| `cancelAppointment(id, reason?)` | Either | Cancel |\n| `rescheduleAppointment(id, newStartTime)` | Either | Reschedule |',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              examples: {
                list: {
                  summary: 'List upcoming',
                  value: {
                    query:
                      '{ appointments(view: "upcoming") { id status startTime professional { id firstName } } }',
                  },
                },
                book: {
                  summary: 'Book appointment',
                  value: {
                    query:
                      'mutation { bookAppointment(professionalId: "PROF_ID", professionalType: "lawyer", startTime: "2026-06-15T10:00:00Z") { id status meetingRoomId } }',
                  },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Appointment data' } },
      },
    },

    '/graphql/chat': {
      post: {
        tags: ['GraphQL — Chat'],
        summary: 'query chats · query chatMessages · mutations',
        description:
          'Real-time messaging. Socket.io handles live delivery; GraphQL handles persistence and history.\n\n| Operation | Description |\n|-----------|-------------|\n| `chats` | List all chats for the authenticated user |\n| `chatMessages(chatId)` | Fetch message history (marks as read) |\n| `getOrCreateChat(participantId)` | Open or retrieve a direct chat |\n| `sendMessage(chatId, content)` | Send a message |\n| `deleteMessage(chatId, messageId)` | Soft-delete a message |\n| `markMessagesRead(chatId)` | Mark all messages in chat as read |',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              example: {
                query:
                  'mutation { getOrCreateChat(participantId: "USER_ID") { id participants { id firstName } } }',
              },
            },
          },
        },
        responses: { 200: { description: 'Chat data' } },
      },
    },

    '/graphql/payments': {
      post: {
        tags: ['GraphQL — Payments'],
        summary: 'query paymentHistory · query mySubscription · mutations',
        description:
          'Stripe-backed payments and subscriptions.\n\n| Operation | Who | Description |\n|-----------|-----|-------------|\n| `paymentHistory` | Auth | List own payments |\n| `mySubscription` | Victim | Active subscription |\n| `createAppointmentPaymentIntent(appointmentId)` | Victim | Start Stripe payment flow |\n| `createSubscription(plan, currency, paymentMethodId)` | Victim | Subscribe to a plan |\n| `cancelSubscription` | Victim | Cancel at period end |\n\n**Plans**: `basic` · `premium` &nbsp;|&nbsp; **Currencies**: `USD` · `GBP` · `INR`',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              example: {
                query:
                  'mutation { createAppointmentPaymentIntent(appointmentId: "APPT_ID") { clientSecret paymentId } }',
              },
            },
          },
        },
        responses: { 200: { description: 'Payment data' } },
      },
    },

    '/graphql/notifications': {
      post: {
        tags: ['GraphQL — Notifications'],
        summary: 'query notifications · mutations',
        description:
          '| Operation | Description |\n|-----------|-------------|\n| `notifications(unreadOnly?)` | Paginated notifications + unread count |\n| `markNotificationsRead(ids?)` | Mark specific or all as read |\n| `deleteNotification(id)` | Delete one notification |',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              example: {
                query:
                  '{ notifications(unreadOnly: true) { unreadCount notifications { id type title body isRead } } }',
              },
            },
          },
        },
        responses: { 200: { description: 'Notifications' } },
      },
    },

    '/graphql/sos': {
      post: {
        tags: ['GraphQL — SOS'],
        summary: 'mutation triggerSOS · mutation resolveSOS · query sosHistory',
        description:
          'Emergency SOS events. Triggering an SOS notifies the emergency number configured in the server environment.\n\n| Operation | Who | Description |\n|-----------|-----|-------------|\n| `triggerSOS(latitude?, longitude?)` | Victim | Create an SOS event |\n| `resolveSOS(id, notes?)` | Admin/Volunteer | Mark as resolved |\n| `sosHistory` | Auth | List own SOS events |',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              example: {
                query:
                  'mutation { triggerSOS(latitude: 51.5074, longitude: -0.1278) { success emergencyNumber event { id status } } }',
              },
            },
          },
        },
        responses: { 200: { description: 'SOS event' } },
      },
    },

    '/graphql/reviews': {
      post: {
        tags: ['GraphQL — Reviews'],
        summary: 'query reviews · mutation createReview',
        description:
          'One review per victim-professional pair (enforced by unique index).\n\nAnonymous reviews hide the reviewer identity from all non-admin users.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              examples: {
                list: {
                  summary: 'List reviews',
                  value: {
                    query:
                      '{ reviews(professionalId: "PROF_ID") { id rating comment isAnonymous } }',
                  },
                },
                create: {
                  summary: 'Create review',
                  value: {
                    query:
                      'mutation { createReview(professionalId: "PROF_ID", appointmentId: "APPT_ID", rating: 5, comment: "Excellent session", isAnonymous: false) { id rating } }',
                  },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Review data' } },
      },
    },

    '/graphql/awareness': {
      post: {
        tags: ['GraphQL — Awareness'],
        summary: 'query articles · query article · admin mutations',
        description:
          'Public awareness blog. Queries require no authentication.\n\n| Operation | Who | Description |\n|-----------|-----|-------------|\n| `articles(category?, tag?)` | Public | Paginated published articles |\n| `article(slug)` | Public | Fetch one article (increments view count) |\n| `createArticle(…)` | Admin | Draft a new article |\n| `publishArticle(id)` | Admin | Make an article public |\n| `deleteArticle(id)` | Admin | Delete an article |',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              example: {
                query:
                  '{ articles(category: "legal_rights") { id title slug excerpt coverImage publishedAt } }',
              },
            },
          },
        },
        responses: { 200: { description: 'Articles' } },
      },
    },
  },
};

export default swaggerDefinition;
