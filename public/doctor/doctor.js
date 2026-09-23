const token = localStorage.getItem('clinicToken');
const queue = document.querySelector('#queue');
const attended = document.querySelector('#attended');
const stats = document.querySelector('#doctorStats');

const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
const formatDate = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date pending';
const formatTime = (value) => value ? value.slice(0, 5) : 'Time pending';

async function readJson(response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) throw new Error('The doctor service is temporarily unavailable. Please refresh the page.');
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'The doctor service could not complete that request.');
  return data;
}

function appointmentCard(appointment) {
  const emergency = Boolean(appointment.is_emergency);
  return `
    <article class="doctor-appointment ${emergency ? 'emergency-appointment' : ''}">
      <div class="appointment-time">
        <strong>${escapeHtml(formatTime(appointment.start_time))}</strong>
        <span>${escapeHtml(formatDate(appointment.appointment_date))}</span>
      </div>
      <div class="appointment-patient">
        <div class="patient-avatar">${escapeHtml((appointment.patient_name || 'P').slice(0, 1).toUpperCase())}</div>
        <div>
          <h3>${escapeHtml(appointment.patient_name || 'Patient')}</h3>
          <p>${escapeHtml(appointment.phone || 'Contact details unavailable')}</p>
        </div>
      </div>
      <div class="appointment-actions">
        ${emergency ? '<span class="emergency-label">Emergency patient</span>' : '<button type="button" class="text-button" data-action="emergency" data-id="' + appointment.appointment_id + '">Mark emergency</button>'}
        <button type="button" class="button button-primary small-button" data-action="complete" data-id="${appointment.appointment_id}">Mark attended</button>
      </div>
    </article>
  `;
}

function attendedRow(appointment) {
  return `
    <article class="attended-row">
      <div class="patient-avatar muted-avatar">${escapeHtml((appointment.patient_name || 'P').slice(0, 1).toUpperCase())}</div>
      <div class="attended-patient"><strong>${escapeHtml(appointment.patient_name || 'Patient')}</strong><span>${escapeHtml(appointment.phone || 'No phone on file')}</span></div>
      <span class="attended-date">${escapeHtml(formatDate(appointment.appointment_date))} · ${escapeHtml(formatTime(appointment.start_time))}</span>
      <span class="status-badge completed">Completed</span>
    </article>
  `;
}

function render(data) {
  const currentQueue = data.queue || [];
  const history = data.attended || [];
  document.querySelector('#doctorGreeting').textContent = `Good day, ${data.doctor.doctor_name}`;
  stats.innerHTML = `
    <div class="doctor-stat"><span>Upcoming</span><strong>${currentQueue.length}</strong><small>appointments in queue</small></div>
    <div class="doctor-stat"><span>Attended</span><strong>${history.length}</strong><small>completed patient visits</small></div>
    <div class="doctor-stat"><span>Specialty</span><strong class="doctor-specialty">${escapeHtml(data.doctor.specialization)}</strong><small>your clinical service</small></div>
  `;
  queue.innerHTML = currentQueue.length ? currentQueue.map(appointmentCard).join('') : '<div class="portal-empty">Your upcoming queue is clear.</div>';
  attended.innerHTML = history.length ? history.map(attendedRow).join('') : '<div class="portal-empty">Completed visits will appear here.</div>';
}

async function loadDashboard() {
  if (!token) {
    queue.innerHTML = '<div class="portal-empty">Please sign in with the doctor login to view your workspace.</div>';
    return;
  }
  queue.innerHTML = '<div class="portal-empty">Loading your queue...</div>';
  try {
    const response = await fetch('/api/dashboard/doctor', { headers: { Authorization: `Bearer ${token}` } });
    const data = await readJson(response);
    render(data);
  } catch (error) {
    const message = error.message === 'Failed to fetch' ? 'The clinic service is offline. Start the server and refresh the page.' : error.message;
    queue.innerHTML = `<div class="portal-empty">${escapeHtml(message)} Try again shortly.</div>`;
  }
}

async function updateAppointment(id, path, body) {
  const response = await fetch(`/api/appointments/${id}/${path}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  await readJson(response);
  await loadDashboard();
}

document.querySelector('#refreshQueue').addEventListener('click', loadDashboard);
queue.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  button.disabled = true;
  try {
    if (button.dataset.action === 'complete') await updateAppointment(button.dataset.id, 'status', { status: 'completed' });
    if (button.dataset.action === 'emergency') await updateAppointment(button.dataset.id, 'emergency', { isEmergency: true });
  } catch (error) {
    window.alert(error.message);
    button.disabled = false;
  }
});

document.querySelector('#headerLogout').addEventListener('click', () => {
  localStorage.removeItem('clinicToken');
  localStorage.removeItem('clinicRole');
  localStorage.removeItem('clinicUserName');
  window.location.href = '/doctor-login.html';
});

loadDashboard();