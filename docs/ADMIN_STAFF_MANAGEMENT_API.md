# Admin Staff Management API Documentation

This document describes the new admin endpoints for managing staff members (employees and owners).

## Endpoints Overview

### 1. Get All Staff Members (Paginated)

**GET** `/admin/users/staff`

Retrieve all users with roles of `employee` or `owner` with pagination and search capabilities.

#### Authentication & Authorization

- Requires authentication (`authenticateUser`)
- Requires admin privileges (`isAdmin`)
- Requires permission: `users:read`

#### Query Parameters

| Parameter | Type    | Required | Default | Description                               |
| --------- | ------- | -------- | ------- | ----------------------------------------- |
| `page`    | integer | No       | 1       | Page number (min: 1)                      |
| `limit`   | integer | No       | 50      | Items per page (min: 1, max: 100)         |
| `search`  | string  | No       | -       | Search by first name, last name, or email |
| `sort`    | string  | No       | "-1"    | Sort direction: "1" (asc) or "-1" (desc)  |

#### Response Format

```json
{
  "message": "Staff members fetched successfully",
  "data": {
    "users": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@example.com",
        "role": "employee",
        "image": "https://...",
        "joinedAt": "2024-01-15T10:30:00.000Z",
        "emailVerified": "2024-01-15T12:00:00.000Z",
        "suspended": false,
        "orderCount": 5,
        "totalSpent": 1250.5
      }
    ],
    "total": 42,
    "totalPages": 1,
    "currentPage": 1
  }
}
```

#### Example Request

```bash
# Get first page of staff
curl -X GET "http://localhost:3000/admin/users/staff?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Search for staff by name
curl -X GET "http://localhost:3000/admin/users/staff?search=john&page=1" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Sort ascending
curl -X GET "http://localhost:3000/admin/users/staff?sort=1" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 2. Make User an Employee

**POST** `/admin/users/:id/make-employee`

Quickly promote a user to the `employee` role. This is a convenience endpoint that wraps the role update functionality.

#### Authentication & Authorization

- Requires authentication (`authenticateUser`)
- Requires admin privileges (`isAdmin`)
- Requires permission: `users:update`

#### URL Parameters

| Parameter | Type   | Required | Description                |
| --------- | ------ | -------- | -------------------------- |
| `id`      | string | Yes      | User ID (MongoDB ObjectId) |

#### Response Format

```json
{
  "message": "User role updated successfully"
}
```

#### Example Request

```bash
curl -X POST "http://localhost:3000/admin/users/507f1f77bcf86cd799439011/make-employee" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Error Responses

- **404 Not Found**: User not found

```json
{
  "message": "User not found"
}
```

- **500 Internal Server Error**: Server error

```json
{
  "error": "Something went wrong"
}
```

---

### 3. Update User Role

**PUT** `/admin/users/:id/role`

Update a user's role to any valid role (`owner`, `user`, `employee`, `manager`).

#### Authentication & Authorization

- Requires authentication (`authenticateUser`)
- Requires admin privileges (`isAdmin`)
- Requires permission: `users:update`

#### URL Parameters

| Parameter | Type   | Required | Description                |
| --------- | ------ | -------- | -------------------------- |
| `id`      | string | Yes      | User ID (MongoDB ObjectId) |

#### Request Body

```json
{
  "role": "employee"
}
```

| Field  | Type   | Required | Valid Values                           | Description            |
| ------ | ------ | -------- | -------------------------------------- | ---------------------- |
| `role` | string | Yes      | `owner`, `user`, `employee`, `manager` | The new role to assign |

#### Response Format

```json
{
  "message": "User role updated successfully"
}
```

#### Example Requests

```bash
# Make user an employee
curl -X PUT "http://localhost:3000/admin/users/507f1f77bcf86cd799439011/role" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "employee"}'

# Make user an owner
curl -X PUT "http://localhost:3000/admin/users/507f1f77bcf86cd799439011/role" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "owner"}'

# Demote to regular user
curl -X PUT "http://localhost:3000/admin/users/507f1f77bcf86cd799439011/role" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role": "user"}'
```

#### Error Responses

- **400 Bad Request**: Invalid role or missing field

```json
{
  "errors": [
    {
      "msg": "role must be a either of owner,user,manager or employee",
      "param": "role",
      "location": "body"
    }
  ]
}
```

- **404 Not Found**: User not found

```json
{
  "message": "User not found"
}
```

---

## User Roles

The system supports the following roles:

| Role       | Description                            |
| ---------- | -------------------------------------- |
| `user`     | Regular customer (default)             |
| `employee` | Staff member with limited admin access |
| `manager`  | Manager with elevated privileges       |
| `owner`    | Full administrative access             |

---

## Technical Details

### Service Layer (`Admin_UserService`)

#### `getStaff()`

- Uses MongoDB aggregation pipeline
- Filters users where `role` is `employee` or `owner`
- Joins with orders collection to calculate `orderCount` and `totalSpent`
- Supports text search across `firstName`, `lastName`, and `email`
- Returns paginated results with metadata

#### `updateUserRole()`

- Finds user by ID
- Updates the `role` field
- Validates role against enum values in User model

### Validation Layer (`Admin_UserValidator`)

#### `getStaffValidator`

- Validates query parameters using `express-validator`
- Ensures `page` and `limit` are positive integers
- Ensures `limit` doesn't exceed 100
- Validates `sort` is either "1" or "-1"

#### `makeEmployeeValidator`

- Validates user ID in URL params

#### `updateUserRoleValidator`

- Validates `role` is one of: `owner`, `user`, `manager`, `employee`
- Ensures role field is present and non-empty

---

## Database Schema

### User Model Fields (relevant to staff management)

```typescript
{
  role: {
    type: String,
    enum: ['owner', 'user', 'employee'],
    default: 'user',
  },
  suspended: Boolean,
  emailVerified: Date | null,
  // ... other fields
}
```

---

## Testing

### Test Scenarios

1. **Get Staff - Empty Results**

   - No employees or owners exist
   - Should return empty array with total: 0

2. **Get Staff - Pagination**

   - Create 60 staff members
   - Request page 1 with limit 50
   - Should return 50 users
   - Request page 2 with limit 50
   - Should return 10 users

3. **Get Staff - Search**

   - Search for "john"
   - Should return only staff with matching name/email

4. **Make Employee**

   - Convert regular user to employee
   - Verify role is updated
   - Verify user appears in staff list

5. **Update Role - Valid**

   - Update role to each valid enum value
   - Verify role is changed

6. **Update Role - Invalid**

   - Try to set invalid role (e.g., "admin")
   - Should return 400 validation error

7. **Authorization**
   - Try endpoints without token
   - Try endpoints with non-admin user
   - Should return 401/403

### Sample Test Code (Jest/Supertest)

```typescript
describe('Admin Staff Management', () => {
  let adminToken: string;
  let userId: string;

  beforeAll(async () => {
    // Login as admin and get token
    const res = await request(app).post('/auth/login').send({ email: 'admin@test.com', password: 'password' });
    adminToken = res.body.data.token;
  });

  describe('GET /admin/users/staff', () => {
    it('should return paginated staff list', async () => {
      const res = await request(app)
        .get('/admin/users/staff?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('users');
      expect(res.body.data).toHaveProperty('total');
      expect(res.body.data).toHaveProperty('totalPages');
    });

    it('should filter by search term', async () => {
      const res = await request(app).get('/admin/users/staff?search=john').set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(
        res.body.data.users.every(
          (u) =>
            u.firstName.toLowerCase().includes('john') ||
            u.lastName.toLowerCase().includes('john') ||
            u.email.toLowerCase().includes('john')
        )
      ).toBe(true);
    });
  });

  describe('POST /admin/users/:id/make-employee', () => {
    it('should promote user to employee', async () => {
      const res = await request(app)
        .post(`/admin/users/${userId}/make-employee`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('updated');
    });

    it('should return 404 for non-existent user', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const res = await request(app)
        .post(`/admin/users/${fakeId}/make-employee`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /admin/users/:id/role', () => {
    it('should update user role', async () => {
      const res = await request(app)
        .put(`/admin/users/${userId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'owner' });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('updated');
    });

    it('should reject invalid role', async () => {
      const res = await request(app)
        .put(`/admin/users/${userId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'invalid_role' });

      expect(res.status).toBe(400);
    });
  });
});
```

---

## Security Considerations

1. **Authentication Required**: All endpoints require valid JWT token
2. **Admin Authorization**: Only users with admin privileges can access these endpoints
3. **Permission Checks**: Additional permission layer checks for specific actions
4. **Input Validation**: All inputs are validated before processing
5. **Rate Limiting**: Consider adding rate limiting to prevent abuse
6. **Audit Logging**: Consider logging all role changes for audit trail

---

## Performance Considerations

1. **Pagination**: Default limit of 50 prevents large data transfers
2. **Aggregation Pipeline**: Efficiently joins orders data in single query
3. **Indexes**: Ensure indexes on:
   - `role` field
   - `firstName`, `lastName`, `email` for text search
   - `createdAt` for sorting

### Recommended Indexes

```javascript
// In MongoDB shell or migration script
db.users.createIndex({ role: 1 });
db.users.createIndex({ firstName: 1, lastName: 1, email: 1 });
db.users.createIndex({ createdAt: -1 });
```

---

## Future Enhancements

1. **Bulk Operations**: Add endpoint to promote/demote multiple users at once
2. **Role History**: Track role changes over time
3. **Export**: Add CSV/Excel export for staff list
4. **Advanced Filters**: Filter by suspended status, email verified, etc.
5. **Staff Analytics**: Dashboard showing staff performance metrics
6. **Role Permissions**: More granular permission system per role
