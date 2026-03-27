import { SCENARIO_1, SCENARIO_2, SCENARIO_3, SCENARIO_4 } from './solutions'

const asyncMeta = {
  id: 'async',
  slug: 'async',
  title: 'Async & Dynamic Content',
  description: 'Practice waiting for elements that appear after delays, writing robust assertions for loading states, and working with debounced inputs.',
  scenarios: [
    {
      id: 'scenario-1',
      title: 'Wait for async data load',
      description: 'Click "Load Users", assert the spinner appears, wait for the user list to appear, then assert the spinner is gone and 5 user cards are visible.',
      solution: SCENARIO_1,
    },
    {
      id: 'scenario-2',
      title: 'Debounced search filtering',
      description: 'Type "Widget" into the search input, wait for the debounce delay to pass, then assert that exactly 3 results are shown.',
      solution: SCENARIO_2,
    },
    {
      id: 'scenario-3',
      title: 'Load more items',
      description: 'Assert there are 5 items, click "Load More", assert a spinner appears, then assert there are now 10 items.',
      solution: SCENARIO_3,
    },
    {
      id: 'scenario-4',
      title: 'Load More button disappears when exhausted',
      description: 'Click "Load More" enough times to load all 20 items, then assert the button is no longer visible.',
      solution: SCENARIO_4,
    },
  ],
}

export default asyncMeta
