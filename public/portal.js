function isPastAppointment(appointment) {
  return appointment.appointment_date < new Date().toISOString().slice(0, 10);
}

function appointmentCard(a) {
  const status = (a.status || 'booked').toLowerCase();
  const title = a.doctor_name || 'Appointment';
  const canCancel = status === 'booked' && !isPastAppointment(a);

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
      ${canCancel ? `<div class="portal-actions"><button type="button" class="button button-secondary cancel-button" data-action="cancel" data-appointment-id="${a.appointment_id}">Cancel appointment</button></div>` : ''}
    </article>
  `;
}

async function loadAppointments() {
  const token = localStorage.getItem('clinicToken');
  const output = document.querySelector('#output');
  const isPatientHistoryPage = window.location.pathname === '/patient/appointments.html';

  if (!output) return;

  if (!token) {
    output.innerHTML = '<div class="portal-empty">Please sign in from the home page first.</div>';
    return;
  }

  try {
    const response = await fetch('/api/appointments', { headers: { Authorization: `Bearer ${token}` } });
    const rows = await response.json();
    const upcoming = rows.filter((appointment) => appointment.status !== 'cancelled' && !isPastAppointment(appointment));
    const previous = rows.filter((appointment) => appointment.status !== 'cancelled' && isPastAppointment(appointment));

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
  } catch (error) {
    if (output) output.innerHTML = '<div class="portal-empty">Unable to load appointments. Please try again.</div>';
  }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const headerLogout = document.getElementById('headerLogout');

  if (headerLogout) {
    headerLogout.addEventListener('click', () => {
      localStorage.removeItem('clinicToken');
      localStorage.removeItem('clinicRole');
      localStorage.removeItem('clinicUserName');
      window.location.href = '/';
    });
  }

  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action="cancel"]');
    if (!button) return;

    const appointmentId = button.dataset.appointmentId;
    if (!appointmentId || !window.confirm('Cancel this appointment?')) return;

    try {
      const response = await fetch(`/api/appointments/${appointmentId}/cancel`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('clinicToken')}`
        }
      });

      const payload = await response.json().catch(() => ({ error: 'Unable to cancel appointment.' }));
      if (!response.ok) throw new Error(payload.error || 'Unable to cancel appointment.');
      loadAppointments();
    } catch (error) {
      window.alert(error.message || 'Unable to cancel appointment.');
    }
  });

  loadAppointments();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { appointmentCard, isPastAppointment, loadAppointments };
}