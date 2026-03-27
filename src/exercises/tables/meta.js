import { SCENARIO_1, SCENARIO_2, SCENARIO_3, SCENARIO_4, SCENARIO_5 } from './solutions'

const tablesMeta = {
  id: 'tables',
  slug: 'tables',
  title: 'Tables & Lists',
  description: 'Practice traversing and asserting on tabular data. Learn to test sorting, filtering, pagination, and row selection patterns.',
  scenarios: [
    {
      id: 'scenario-1',
      title: 'Sort by column',
      description: 'Click the Name column header to sort ascending — assert Alice Chen is first. Click again to sort descending — assert Zara Williams is first.',
      solution: SCENARIO_1,
    },
    {
      id: 'scenario-2',
      title: 'Filter by department',
      description: 'Type "HR" into the filter input and assert exactly 4 rows are visible, each containing "HR".',
      solution: SCENARIO_2,
    },
    {
      id: 'scenario-3',
      title: 'Pagination navigation',
      description: 'Assert the first page info text, navigate to page 2 with the Next button, assert the updated info text and that Prev is now enabled, then navigate back.',
      solution: SCENARIO_3,
    },
    {
      id: 'scenario-4',
      title: 'Row selection count',
      description: 'Check individual row checkboxes and assert the selected count updates correctly. Uncheck one and assert the count decrements.',
      solution: SCENARIO_4,
    },
    {
      id: 'scenario-5',
      title: 'Select All on current page',
      description: 'Check the select-all checkbox and assert all 5 visible row checkboxes are checked and the count shows 5.',
      solution: SCENARIO_5,
    },
  ],
}

export default tablesMeta
