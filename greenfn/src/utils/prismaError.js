const { httpError } = require('./httpError')

function mapPrismaError(error) {
  if (!error || typeof error !== 'object') {
    return error
  }

  const prismaCode = error.code

  if (!prismaCode || typeof prismaCode !== 'string') {
    return error
  }

  switch (prismaCode) {
    case 'P2002': {
      const fields = error.meta?.target || []
      return httpError(409, 'Unique constraint violation', {
        prismaCode,
        fields,
      })
    }

    case 'P2003': {
      const fieldName = error.meta?.field_name
      return httpError(409, 'Foreign key constraint violation', {
        prismaCode,
        fieldName,
      })
    }

    case 'P2025': {
      return httpError(404, 'Requested record was not found', {
        prismaCode,
        cause: error.meta?.cause,
      })
    }

    case 'P2014': {
      return httpError(409, 'Operation violates required relation constraints', {
        prismaCode,
        relationName: error.meta?.relation_name,
      })
    }

    default: {
      return httpError(500, 'Database operation failed', {
        prismaCode,
      })
    }
  }
}

module.exports = { mapPrismaError }
