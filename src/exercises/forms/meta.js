import { SCENARIO_1, SCENARIO_2, SCENARIO_3, SCENARIO_4 } from './solutions'

const formsMeta = {
  id: 'forms',
  slug: 'forms',
  title: 'Forms & Inputs',
  description: 'Practice locating and interacting with every common form element type. Learn to assert on validation errors, field states, and success messages after submission.',
  scenarios: [
    {
      id: 'scenario-1',
      title: 'Fill and submit a valid form',
      description: 'Fill all fields with valid data, check the terms checkbox, select a radio button, and assert the success message is visible.',
      solution: SCENARIO_1,
    },
    {
      id: 'scenario-2',
      title: 'Required field validation',
      description: 'Click submit without filling anything in and assert that all required field error messages appear.',
      solution: SCENARIO_2,
    },
    {
      id: 'scenario-3',
      title: 'Password minimum length',
      description: 'Enter a password under 8 characters, blur the field, and assert the error message appears.',
      solution: SCENARIO_3,
    },
    {
      id: 'scenario-4',
      title: 'Invalid email format',
      description: 'Enter a string that is not a valid email address, blur the field, and assert the error message appears.',
      solution: SCENARIO_4,
    },
  ],
}

export default formsMeta
