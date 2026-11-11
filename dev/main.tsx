import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { StaticMap } from '../src'

function App() {
  return (
    <main style={{ fontFamily: 'system-ui', padding: 32 }}>
      <h1>landjepik playground</h1>
      <StaticMap lat={59.9139} lon={10.7522} zoom={14} width={600} height={400} />
      <StaticMap
        lat={60.3913}
        lon={5.3221}
        zoom={12}
        width={300}
        height={200}
        marker={{ color: '#2563eb', size: 32 }}
        onRender={(blob) => console.log('rendered', blob.size, 'bytes')}
      />
      <StaticMap provider="kartverket" lat={59.9139} lon={10.7522} zoom={14} width={600} height={400} />
      <StaticMap provider="kartverket-grey" lat={59.9139} lon={10.7522} zoom={14} width={300} height={200} />
      <StaticMap provider="kartverket-raster" lat={61.6364} lon={8.3125} zoom={12} width={300} height={200} />
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
