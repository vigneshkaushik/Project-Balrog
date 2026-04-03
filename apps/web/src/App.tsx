import { Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { ClashInspector } from './components/inspector/ClashInspector'
import { LandingPage } from './components/landing/LandingPage'

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="inspector" element={<ClashInspector />} />
      </Route>
    </Routes>
  )
}
