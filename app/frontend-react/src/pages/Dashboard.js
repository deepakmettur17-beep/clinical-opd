import { Link } from "react-router-dom";

function Dashboard() {
  return (
    <div style={{ textAlign: "center", marginTop: "80px" }}>
      <h1>Clinical OPD System</h1>

      <br />

      <Link to="/patients">
        <button>Patients</button>
      </Link>

      <br /><br />

      <Link to="/visits">
        <button>Visits</button>
      </Link>
    </div>
  );
}

export default Dashboard;