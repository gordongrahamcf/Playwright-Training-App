import { useState } from 'react'
import styles from './FormsExercise.module.css'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate(values) {
  const errors = {}
  if (!values.name.trim()) errors.name = 'Name is required'
  if (!values.email.trim()) {
    errors.email = 'Email is required'
  } else if (!EMAIL_RE.test(values.email)) {
    errors.email = 'Enter a valid email address'
  }
  if (!values.password) {
    errors.password = 'Password is required'
  } else if (values.password.length < 8) {
    errors.password = 'Password must be at least 8 characters'
  }
  if (!values.terms) errors.terms = 'You must accept the terms'
  return errors
}

export default function FormsExercise() {
  const [values, setValues] = useState({
    name: '', email: '', password: '', role: 'tester', terms: false, newsletter: 'no',
  })
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setValues(v => ({ ...v, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleBlur = (e) => {
    const { name } = e.target
    const fieldErrors = validate(values)
    if (fieldErrors[name]) {
      setErrors(prev => ({ ...prev, [name]: fieldErrors[name] }))
    } else {
      setErrors(prev => { const next = { ...prev }; delete next[name]; return next })
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const fieldErrors = validate(values)
    setErrors(fieldErrors)
    if (Object.keys(fieldErrors).length === 0) {
      setSubmitted(true)
    }
  }

  if (submitted) {
    return (
      <div data-testid="success-message" className={styles.success}>
        <span className={styles.successIcon}>✓</span>
        Registration successful! Welcome, {values.name}.
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className={styles.form}>
      <h2 className={styles.formTitle}>Create Account</h2>

      <div className={styles.field}>
        <label htmlFor="name">Full Name</label>
        <input
          id="name" name="name" type="text"
          data-testid="input-name"
          value={values.name}
          onChange={handleChange}
          onBlur={handleBlur}
          className={errors.name ? styles.inputError : ''}
        />
        {errors.name && <span className={styles.error} data-testid="error-name">{errors.name}</span>}
      </div>

      <div className={styles.field}>
        <label htmlFor="email">Email</label>
        <input
          id="email" name="email" type="email"
          data-testid="input-email"
          value={values.email}
          onChange={handleChange}
          onBlur={handleBlur}
          className={errors.email ? styles.inputError : ''}
        />
        {errors.email && <span className={styles.error} data-testid="error-email">{errors.email}</span>}
      </div>

      <div className={styles.field}>
        <label htmlFor="password">Password</label>
        <input
          id="password" name="password" type="password"
          data-testid="input-password"
          value={values.password}
          onChange={handleChange}
          onBlur={handleBlur}
          className={errors.password ? styles.inputError : ''}
        />
        {errors.password && <span className={styles.error} data-testid="error-password">{errors.password}</span>}
      </div>

      <div className={styles.field}>
        <label htmlFor="role">Role</label>
        <select id="role" name="role" data-testid="select-role" value={values.role} onChange={handleChange}>
          <option value="tester">Tester</option>
          <option value="developer">Developer</option>
          <option value="manager">Manager</option>
        </select>
      </div>

      <div className={styles.field}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox" name="terms"
            data-testid="checkbox-terms"
            checked={values.terms}
            onChange={handleChange}
          />
          I accept the terms and conditions
        </label>
        {errors.terms && <span className={styles.error} data-testid="error-terms">{errors.terms}</span>}
      </div>

      <div className={styles.field}>
        <span className={styles.radioLabel}>Newsletter</span>
        <div className={styles.radioGroup}>
          <label>
            <input
              type="radio" name="newsletter" value="yes"
              data-testid="radio-newsletter-yes"
              checked={values.newsletter === 'yes'}
              onChange={handleChange}
            />
            Yes
          </label>
          <label>
            <input
              type="radio" name="newsletter" value="no"
              data-testid="radio-newsletter-no"
              checked={values.newsletter === 'no'}
              onChange={handleChange}
            />
            No
          </label>
        </div>
      </div>

      <button type="submit" data-testid="btn-submit" className={styles.submitBtn}>
        Create Account
      </button>
    </form>
  )
}
