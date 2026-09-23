const token = localStorage.getItem('clinicToken');
const message = document.querySelector('#message');
const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
const api = async (path, options = {}) => { const response = await fetch(`/api${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Request failed'); return data; };
const escapeHtml = value => String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
async function load() {
  if (!token) { message.textContent = 'Sign in with an administrator account first.'; return; }
  try {
    const [stats, doctors, specializations] = await Promise.all([api('/dashboard/admin'), api('/doctors'), api('/specializations')]);
    document.querySelector('#stats').innerHTML = `<article class="doctor"><span class="specialty">Users</span><h3>${stats.users.reduce((sum, row) => sum + Number(row.count), 0)}</h3><p>Registered accounts</p></article><article class="doctor"><span class="specialty">Doctors</span><h3>${stats.doctors}</h3><p>Active clinicians</p></article><article class="doctor"><span class="specialty">Appointments</span><h3>${stats.appointments.reduce((sum, row) => sum + Number(row.count), 0)}</h3><p>Across all statuses</p></article>`;
    document.querySelector('#roster').innerHTML = doctors.map(doctor => {
      const id = doctor.doctor_id;
      const options = specializations.map(item => `<option value="${item.specialization_id}" ${item.name === doctor.specialization ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('');
      return `<article class="doctor admin-doctor"><span class="specialty">${escapeHtml(doctor.specialization)}</span><h3>${escapeHtml(doctor.full_name)}</h3><p>₹${doctor.consultation_fee || '—'} · ${doctor.years_experience} years · ${doctor.daily_capacity}/day</p><div class="admin-form"><select data-specialization="${id}">${options}</select><input data-fee="${id}" type="number" min="0" value="${doctor.consultation_fee || ''}" placeholder="Fee in ₹"><input data-capacity="${id}" type="number" min="1" value="${doctor.daily_capacity}" placeholder="Daily capacity"><button class="button save-doctor" data-id="${id}">Save profile</button><div class="availability-form"><select data-day="${id}"><option value="1">Monday</option><option value="2">Tuesday</option><option value="3">Wednesday</option><option value="4">Thursday</option><option value="5">Friday</option><option value="6">Saturday</option><option value="0">Sunday</option></select><input data-start="${id}" type="time" value="09:00"><input data-end="${id}" type="time" value="17:00"><button class="text-button add-availability" data-id="${id}">Add availability</button></div></div></article>`;
    }).join('');
    document.querySelectorAll('.save-doctor').forEach(button => button.onclick = async () => { const id = button.dataset.id; await api(`/doctors/${id}`, { method: 'PUT', body: JSON.stringify({ specializationId: document.querySelector(`[data-specialization="${id}"]`).value, consultationFee: document.querySelector(`[data-fee="${id}"]`).value, dailyCapacity: document.querySelector(`[data-capacity="${id}"]`).value }) }); message.textContent = 'Doctor profile updated.'; });
    document.querySelectorAll('.add-availability').forEach(button => button.onclick = async () => { const id = button.dataset.id; await api('/availability', { method: 'POST', body: JSON.stringify({ doctorId: id, dayOfWeek: document.querySelector(`[data-day="${id}"]`).value, startTime: document.querySelector(`[data-start="${id}"]`).value, endTime: document.querySelector(`[data-end="${id}"]`).value }) }); message.textContent = 'Availability added.'; });
  } catch (error) { message.textContent = error.message === 'FORBIDDEN' ? 'This page requires an admin account.' : error.message; }
}
document.querySelector('#signOut').onclick = () => { localStorage.clear(); location.href = '/'; };
load();
