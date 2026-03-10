import { HashRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout/Layout'
import Home from './pages/Home/Home'
import ExercisePage from './pages/Exercise/Exercise'

export default function Router() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="exercises/:slug" element={<ExercisePage />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
