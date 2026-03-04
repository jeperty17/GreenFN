const { httpError } = require('../utils/httpError')

function validateBody(validateFn) {
  return (req, _res, next) => {
    const errors = validateFn(req.body)

    if (errors.length > 0) {
      return next(httpError(400, 'Validation failed', errors))
    }

    return next()
  }
}

function requiredString(value, fieldName, errors) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.push({ field: fieldName, message: `${fieldName} is required` })
  }
}

module.exports = {
  validateBody,
  requiredString,
}
