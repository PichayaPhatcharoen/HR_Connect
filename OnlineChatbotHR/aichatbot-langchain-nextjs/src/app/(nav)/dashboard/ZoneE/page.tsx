export default function DashboardPage() {
  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <iframe
        src="https://app.powerbi.com/view?r=eyJrIjoiMWM4NmRjNzctYjM1OC00N2I5LTliMTMtMThlOWVlMDFmYTcyIiwidCI6ImZkMjA2NzE1LTc1MDktNGFlNS05Yjk2LTc2YmI5Nzg4NmE4NCIsImMiOjEwfQ%3D%3D&pageName=e34d6cb0179cb9384a2e"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
        }}
        allowFullScreen
      />
    </div>
  )
}
