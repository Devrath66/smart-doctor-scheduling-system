const token = localStorage.getItem('clinicToken');
const output = document.querySelector('#output');
const headerLogout = document.getElementById('headerLogout');
const isPatientHistoryPage = window.location.pathname === '/patient/appointments.html';

function isPastAppointment(appointment) {
  return appointment.appointment_date < new Date().toISOString().slice(0, 10);
}

function appointmentCard(a) {
  const status = (a.status || 'booked').toLowerCase();
  const title = a.doctor_name || 'Appointment';
  return `
    <article class="portal-card ${isPastAppointment(a) ? 'previous-care-card' : ''}">
      <div class="portal-card-header">
        <span class="status-badge ${status}">${status}</span>
        <span class="portal-pill">Doctor consult</span>
      </div>
      <div>
        <h2 class="portal-card-title">${title}</h2>
        <p>${a.appointment_date} at ${a.start_time}</p>
      </div>
      <div class="portal-meta">
        <div class="portal-meta-row"><span>Doctor</span><strong>${a.doctor_name || 'Appointment'}</strong></div>
        <div class="portal-meta-row"><span>Time</span><strong>${a.start_time} - ${a.end_time}</strong></div>
        <div class="portal-meta-row"><span>Visit Type</span><strong>${a.status || 'Booked'}</strong></div>
      </div>
    </article>
  `;
}

if (headerLogout) {
  headerLogout.addEventListener('click', () => {
    localStorage.removeItem('clinicToken');
    localStorage.removeItem('clinicRole');
    localStorage.removeItem('clinicUserName');
    window.location.href = '/';
  });
}

if (!token) {
  output.innerHTML = '<div class="portal-empty">Please sign in from the home page first.</div>';
} else {
  fetch('/api/appointments', { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => r.json())
    .then((rows) => {
      const upcoming = rows.filter((appointment) => !isPastAppointment(appointment));
      const previous = rows.filter(isPastAppointment);

      if (!rows.length) {
        output.innerHTML = '<div class="portal-empty">No appointments yet. Your care schedule will appear here.</div>';
        return;
      }

      if (!isPatientHistoryPage) {
        output.innerHTML = upcoming.length ? upcoming.map(appointmentCard).join('') : '<div class="portal-empty">You have no upcoming appointments.</div>';
        return;
      }

      output.className = 'appointment-history-layout';
      output.innerHTML = `
        <section class="appointment-history-section">
          <div class="section-heading"><div><p class="eyebrow">Scheduled care</p><h2>Upcoming appointments</h2></div></div>
          <div class="portal-grid">${upcoming.length ? upcoming.map(appointmentCard).join('') : '<div class="portal-empty">You have no upcoming appointments.</div>'}</div>
        </section>
        <section class="appointment-history-section previous-care-section">
          <div class="section-heading"><div><p class="eyebrow">Care history</p><h2>Previous care</h2></div></div>
          <div class="portal-grid">${previous.length ? previous.map(appointmentCard).join('') : '<div class="portal-empty">Past appointments will appear here.</div>'}</div>
        </section>
      `;
    })
    .catch(() => {
      output.innerHTML = '<div class="portal-empty">Unable to load appointments. Please try again.</div>';
    });
}