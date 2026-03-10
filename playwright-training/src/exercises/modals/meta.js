import { SCENARIO_1, SCENARIO_2, SCENARIO_3, SCENARIO_4, SCENARIO_5 } from './solutions'

const modalsMeta = {
  id: 'modals',
  slug: 'modals',
  title: 'Modals & Overlays',
  description: 'Practice interacting with dialogs, tooltips, and drawers. Learn to assert on elements that conditionally render (not just hidden).',
  scenarios: [
    {
      id: 'scenario-1',
      title: 'Confirm a modal action',
      description: 'Open the confirmation modal, verify it is visible with the correct message, then confirm and assert the success state.',
      solution: SCENARIO_1,
    },
    {
      id: 'scenario-2',
      title: 'Cancel a modal',
      description: 'Open the modal and cancel. Assert the modal closes and no side effects occurred.',
      solution: SCENARIO_2,
    },
    {
      id: 'scenario-3',
      title: 'Tooltip hover interaction',
      description: 'Hover over the tooltip trigger, assert the tooltip content is visible, then move the mouse away and assert it disappears.',
      solution: SCENARIO_3,
    },
    {
      id: 'scenario-4',
      title: 'Open and close the drawer',
      description: 'Open the settings drawer via the button, verify its content is visible, then close it via the close button.',
      solution: SCENARIO_4,
    },
    {
      id: 'scenario-5',
      title: 'Close drawer via backdrop',
      description: 'Open the drawer and close it by clicking the semi-transparent backdrop overlay behind the drawer.',
      solution: SCENARIO_5,
    },
  ],
}

export default modalsMeta
