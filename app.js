// ==========================================================================
// ENGINE ELITE MASTER v107.5 - LÓGICA DE DADOS E INTEGRAÇÃO (CÓDIGO LIMPO)
// ==========================================================================
let expenseChartInstance = null; // Controla o gráfico para não duplicar na memória
function defaultDb(name = 'Novo Projeto') {
    return { 
        in: [], out: [], cot: [], 
        ambs: ['Sala', 'Cozinha', 'Geral', 'Suíte', 'Varanda'], 
        cats: ['Material', 'Mão de Obra', 'Documentação', 'Compra da Casa', 'Arquiteta', 'Visita Técnica', 'Ajuste de Saldo', 'Móveis', 'Decoração'], 
        projectName: name, lastBackup: 0, deliveryDate: '', saldoInicial: 0, dataSaldoInicial: '',
        faturasPagas: [], retiradas: [], cards: []
    };
}

let appData = JSON.parse(localStorage.getItem('elite_app_data'));
if (!appData) {
    appData = { current: 'Meu Projeto', projects: {} };
    appData.projects[appData.current] = defaultDb(appData.current);
    localStorage.setItem('elite_app_data', JSON.stringify(appData));
}

let db = appData.projects[appData.current];
if(!db.retiradas) db.retiradas = []; 
if(!db.faturasPagas) db.faturasPagas = [];
if(!db.cards) db.cards = [];

const hoje = new Date();
let calMes = hoje.getMonth();
let calAno = hoje.getFullYear();

function save() { 
    appData.projects[appData.current] = db; 
    localStorage.setItem('elite_app_data', JSON.stringify(appData)); 
}

function fmt(v) { 
    return (v || 0).toLocaleString('pt-br', { style: 'currency', currency: 'BRL' }); 
}

function formatCurrencyMask(el) {
    if(!el) return;
    let value = el.value.replace(/\D/g, ''); 
    if(!value) value = '0';
    el.value = (parseInt(value) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); 
    if(document.getElementById('modal').style.display === 'flex') calcTudo();
}

function getRawValue(elId) { 
    let el = typeof elId === 'string' ? document.getElementById(elId) : elId;
    if(!el) return 0;
    let val = el.value.replace(/\D/g, ''); 
    return val ? parseInt(val) / 100 : 0; 
}

function showToast(m, type = 'success') { 
    const c = document.getElementById('toast-container');
    if(!c) return;
    const t = document.createElement('div'); 
    t.className = 'toast'; 
    t.style.background = type === 'success' ? '#0f172a' : '#dc2626';
    t.innerText = m;
    c.appendChild(t); 
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 3000);
}

function tab(e, n) { 
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none'); 
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active')); 
    let el = document.getElementById(n);
    if(el) el.style.display = 'block'; 
    const targetBtn = e ? e.currentTarget : document.getElementById('tab-btn-' + n.replace('aba-', ''));
    if(targetBtn) targetBtn.classList.add('active'); 
    if(n === 'aba-agenda') {
        let filtro = document.getElementById('header-filtro-agenda');
        if(filtro) filtro.innerHTML = '';
    }
    render();
}

function render() {
    const sel = document.getElementById('project-selector');
    if(sel) {
        sel.innerHTML = Object.keys(appData.projects).map(p => 
            `<option value="${p}" ${p === appData.current ? 'selected' : ''}>${p}</option>`
        ).join('') + `<option value="NOVO_PROJETO">+ NOVA OBRA...</option>`;

    }

    let dSaldo = document.getElementById('dash-saldo');
    if(dSaldo) dSaldo.value = db.saldoInicial ? db.saldoInicial.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '';
    
    let dDataSaldo = document.getElementById('dash-data-saldo');
    if(dDataSaldo) dDataSaldo.value = db.dataSaldoInicial || '';
    
    let delivPicker = document.getElementById('delivery-date-picker');
    if(delivPicker) delivPicker.value = db.deliveryDate;

    let cCountdown = document.getElementById('card-countdown');
    if (db.deliveryDate && cCountdown) {
        const diff = Math.ceil((new Date(db.deliveryDate + "T23:59:59") - hoje) / 86400000);
        cCountdown.innerText = diff + " dias";
    } else if(cCountdown) { 
        cCountdown.innerText = "-- dias"; 
    }

    let tInRealizado = db.in.filter(x => new Date(x.data + "T23:59:59") <= hoje).reduce((a,b) => a + b.valor, 0);
    let tPagoOut = 0;
    let tFuturo = 0;
    let tCPT = 0; 
    let parcelasAgenda = [];
    let hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
    let alerts = [];
    let criticalCount = 0;

    db.out.forEach(g => {
        if(g.dataEntrega && !g.entregue) {
            const dIni = new Date(g.dataEntrega + "T12:00:00");
            const dFim = g.dataEntregaFim ? new Date(g.dataEntregaFim + "T12:00:00") : dIni;
            const dHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 12, 0, 0);

            if(dHoje >= dIni && dHoje <= dFim) {
                alerts.push(`<span class="alert-item" style="color:var(--warning)" onclick="tab(null, 'aba-entregas')">🚚 RECEBER HOJE: ${g.desc}</span>`);
            } else if(dHoje > dFim) { 
                criticalCount++; 
                alerts.push(`<span class="alert-item" style="color:var(--danger)" onclick="tab(null, 'aba-entregas')">🚨 ENTREGA ATRASADA: ${g.desc}</span>`); 
            }
        }

        (g.parcelas || []).forEach((p, idx) => {
            const isCartao = (g.metodo === "Cartão de Crédito");
            const dv = new Date(p.data + "T12:00:00");
            const diasParaVencer = Math.ceil((dv - hoje) / 86400000);

            if(p.paga) {
                tPagoOut += p.valor;
            } else {
                tFuturo += p.valor;
                if(!isCartao && diasParaVencer <= 7) { 
                    if(diasParaVencer <= 2) criticalCount++; 
                    alerts.push(`<span class="alert-item" style="color:${diasParaVencer < 0 ? 'var(--danger)' : 'var(--warning)'}" onclick="tab(null, 'aba-agenda')">${diasParaVencer <= 2 ? '🔥' : '⏳'} PAGAR: ${g.desc}</span>`); 
                }
                if(isCartao) tCPT += p.valor;
            }
            parcelasAgenda.push({ gid: g.id, idx: idx, totalParc: g.parcelas.length, desc: g.desc, amb: g.amb, metodo: g.metodo, cartao: g.cartao, data: p.data, valor: p.valor, paga: p.paga });
        });
    });

    db.retiradas.forEach(r => {
        if(!r.concluida && r.data < hojeStr) {
            criticalCount++;
            alerts.push(`<span class="alert-item" style="color:var(--danger)" onclick="tab(null, 'aba-entregas')">🚨 RETIRADA ATRASADA: ${r.desc}</span>`);
        }
    });

    const tEstornosRealizados = db.retiradas.filter(r => r.concluida).reduce((a,b) => a + b.valor, 0);
    const tFaturasTotalPagas = (db.faturasPagas || []).reduce((a, b) => a + b.valorTotal, 0);
    const tPagoNaoCartao = db.out.reduce((acc, g) => { 
        if (g.metodo === "Cartão de Crédito") return acc; 
        return acc + (g.parcelas || []).filter(p => p.paga).reduce((sa, sp) => sa + sp.valor, 0); 
    }, 0);
    
    const saldoCaixa = (parseFloat(db.saldoInicial) || 0) + tInRealizado + tEstornosRealizados - tPagoNaoCartao - tFaturasTotalPagas;
    const saldoLivre = saldoCaixa - tFuturo;

    if(document.getElementById('card-caixa')) document.getElementById('card-caixa').innerText = fmt(saldoCaixa);
    if(document.getElementById('card-futuro')) document.getElementById('card-futuro').innerText = fmt(tFuturo);
    if(document.getElementById('card-livre')) document.getElementById('card-livre').innerText = fmt(saldoLivre);
    if(document.getElementById('card-cartao-total')) document.getElementById('card-cartao-total').innerText = fmt(tCPT);
    
    let livreBox = document.getElementById('card-livre-box');
    if(livreBox) livreBox.className = saldoLivre < 0 ? 'card card-free negative' : 'card card-free';
    if(document.getElementById('intel-divida')) document.getElementById('intel-divida').innerText = `${parcelasAgenda.filter(p=>!p.paga).length} parcelas pendentes.`;

    const burnRate = tPagoOut / Math.max(1, (hoje.getMonth() + 1));
    if(document.getElementById('intel-runway')) document.getElementById('intel-runway').innerText = burnRate > 0 ? `Dura aprox: ${(saldoCaixa/burnRate).toFixed(1)} meses` : "Burn Rate estável.";

    renderAgenda(parcelasAgenda);
    renderGastos();
    renderCotacoes(alerts, hojeStr);
    renderEntradas();
    renderCartao();
    renderFluxo(saldoCaixa);
    renderCalendario();
    updateStatusBar(saldoLivre, alerts, criticalCount);
}

function renderCalendario() {
    const corpo = document.getElementById('cal-dias'); 
    if(!corpo) return;
    corpo.innerHTML = '';
    document.getElementById('cal-mes-ano').innerText = new Date(calAno, calMes, 1).toLocaleDateString('pt-br', {month:'long', year:'numeric'});
    
    const primDia = new Date(calAno, calMes, 1).getDay();
    const diasNoMes = new Date(calAno, calMes + 1, 0).getDate();
    
    for(let i=0; i<primDia; i++) {
        corpo.innerHTML += '<div class="cal-day" style="opacity:0; border-color:transparent;"></div>';
    }
    
    for(let dia=1; dia<=diasNoMes; dia++) {
        let dataStr = `${calAno}-${String(calMes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
        let dtAtual = new Date(calAno, calMes, dia, 12, 0, 0);
        let htmlEvents = '';
        
        db.out.forEach(g => {
            if(!g.dataEntrega) return;
            const dIni = new Date(g.dataEntrega + "T12:00:00");
            const dFim = g.dataEntregaFim ? new Date(g.dataEntregaFim + "T12:00:00") : dIni;
            
            if (g.entregue && g.dataRealEntrega) {
                if (dataStr === g.dataRealEntrega) htmlEvents += `<div class="event-dot" style="background:var(--success)"></div>`;
            } else if (dtAtual >= dIni && dtAtual <= dFim) {
                htmlEvents += `<div class="event-dot" style="background:var(--accent); ${g.dataEntregaFim && (g.dataEntrega !== g.dataEntregaFim) ? 'opacity:0.5;' : ''}"></div>`;
            }
        });

        db.cot.forEach(c => { if(c.dataVisita === dataStr) htmlEvents += `<div class="event-dot" style="background:var(--purple); border-radius:1px;"></div>`; });
        db.retiradas.forEach(r => { if(r.data === dataStr) htmlEvents += `<div class="event-dot" style="background:${r.concluida ? 'var(--success)' : 'var(--danger)'}"></div>`; });

        corpo.innerHTML += `
        <div class="cal-day ${(dia === hoje.getDate() && calMes === hoje.getMonth() && calAno === hoje.getFullYear()) ? 'today' : ''}" onclick="abrirDetalhesDia('${dataStr}')">
            <div class="cal-num">${dia}</div>
            <div class="cal-events">${htmlEvents}</div>
        </div>`;
    }
}

function abrirDetalhesDia(dataStr) {
    const modal = document.getElementById('modal-logistica-dia');
    const corpo = document.getElementById('ml-dia-corpo');
    const titulo = document.getElementById('ml-dia-titulo');
    const dtAtual = new Date(dataStr + "T12:00:00");
    titulo.innerText = dtAtual.toLocaleDateString('pt-br', {weekday:'long', day:'2-digit', month:'long'}).toUpperCase();
    corpo.innerHTML = '';

    const entregas = db.out.filter(g => {
        if(!g.dataEntrega) return false;
        const dIni = new Date(g.dataEntrega + "T12:00:00");
        const dFim = g.dataEntregaFim ? new Date(g.dataEntregaFim + "T12:00:00") : dIni;
        return g.entregue && g.dataRealEntrega ? g.dataRealEntrega === dataStr : dtAtual >= dIni && dtAtual <= dFim;
    });

    if(entregas.length > 0) {
        corpo.innerHTML += `<div class="section-header"><h3>🚚 Materiais / Entregas</h3></div>`;
        entregas.forEach(g => {
            let isJan = g.dataEntregaFim && (g.dataEntrega !== g.dataEntregaFim);
            corpo.innerHTML += `
            <div class="log-item-expand" style="border-left: 4px solid var(--accent)">
                <div><span class="log-tag" style="background:var(--accent); color:white">${g.amb}</span><strong>${g.desc}</strong></div>
                <div style="margin-top:8px; display:flex; justify-content:space-between; align-items:center;">
                    <small>Forn: ${g.fornecedor || 'N/A'}</small>
                    <span class="pill ${g.entregue ? 'pill-success' : (isJan ? 'pill-janela' : 'pill-warn')}">${g.entregue ? 'RECEBIDO' : 'PENDENTE'}</span>
                </div>
                ${!g.entregue ? `<button class="btn-action btn-success" style="width:100%; margin-top:10px; padding:8px;" onclick="confirmarEntregaRapida(${g.id}, '${dataStr}')">CONFIRMAR RECEBIMENTO</button>` : `<button class="btn-action btn-outline" style="width:100%; margin-top:10px; padding:8px;" onclick="reverterEntregaRapida(${g.id})">DESFAZER RECEBIMENTO</button>`}
            </div>`;
        });
    }

    const visitas = db.cot.filter(c => c.dataVisita === dataStr);
    if(visitas.length > 0) {
        corpo.innerHTML += `<div class="section-header"><h3>💼 Visitas Agendadas</h3></div>`;
        visitas.forEach(c => {
            corpo.innerHTML += `
            <div class="log-item-expand" style="border-left: 4px solid var(--purple)">
                <strong>${c.desc}</strong><br><small>${c.amb}</small>
                <div class="buttons-row" style="margin-top:10px;">
                    <button class="btn-action btn-warning" style="flex:1; padding:8px;" onclick="abrirModal('cot-edit', ${c.id}); document.getElementById('modal-logistica-dia').style.display='none';">ORÇAR</button>
                    <button class="btn-action btn-outline" style="flex:1; padding:8px;" onclick="removerVisita(${c.id})">CANCELAR</button>
                </div>
            </div>`;
        });
    }

    const retiradas = db.retiradas.filter(r => r.data === dataStr);
    if(retiradas.length > 0) {
        corpo.innerHTML += `<div class="section-header"><h3>🚨 Retiradas / Estorno</h3></div>`;
        retiradas.forEach(r => {
            corpo.innerHTML += `
            <div class="log-item-expand" style="border-left: 4px solid var(--danger)">
                <strong>${r.desc}</strong><br><small>Estorno: <b style="color:var(--danger)">${fmt(r.valor)}</b></small>
                ${!r.concluida ? `<button class="btn-action btn-danger" style="width:100%; margin-top:10px; padding:8px;" onclick="confirmarEstorno(${r.id})">CONFIRMAR ESTORNO</button>` : `<div style="margin-top:10px; text-align:center; font-weight:800; color:var(--success); font-size:10px;">✅ ESTORNO CONCLUÍDO</div>`}
            </div>`;
        });
    }
    modal.style.display = 'flex';
}

function confirmarEntregaRapida(id, clickedDate) { 
    let g = db.out.find(x => x.id == id); 
    if(g) { g.entregue = true; g.dataRealEntrega = clickedDate; save(); render(); document.getElementById('modal-logistica-dia').style.display = 'none'; showToast("Entrega confirmada!"); } 
}

function reverterEntregaRapida(id) { 
    let g = db.out.find(x => x.id == id); 
    if(g) { g.entregue = false; g.dataRealEntrega = ''; save(); render(); document.getElementById('modal-logistica-dia').style.display = 'none'; showToast("Recepção cancelada."); } 
}

function confirmarEstorno(rid) {
    let r = db.retiradas.find(x => x.id == rid);
    if(!r) return;
    openDialog("Confirmar Estorno", `Deseja inserir ${fmt(r.valor)} no caixa?`, 'none', null, () => {
        r.concluida = true;
        db.in.push({ id: Date.now(), desc: `Estorno: ${r.desc}`, cat: 'Ajuste de Saldo', valor: r.valor, data: hoje.toISOString().split('T')[0] });
        save(); render(); document.getElementById('modal-logistica-dia').style.display = 'none';
    });
}

function pagar(gid, idx) {
    let g = db.out.find(x => x.id == gid);
    if(g) { 
        g.parcelas[idx].paga = !g.parcelas[idx].paga; 
        save(); render(); 
        showToast(g.parcelas[idx].paga ? "Parcela paga!" : "Parcela pendente novamente."); 
    }
}

function renderAgenda(parcelas) {
    const corpo = document.getElementById('corpo-agenda'); 
    if(!corpo) return;
    corpo.innerHTML = '';
    parcelas.sort((a,b) => new Date(a.data) - new Date(b.data));
    let curMes = "";
    
    parcelas.forEach(p => {
        let label = (p.metodo === 'Cartão de Crédito') ? calcularMesFatura(p.data, p.cartao) : new Date(p.data+"T12:00:00").toLocaleDateString('pt-br', {month:'long', year:'numeric'}).toUpperCase();
        if(label !== curMes) { curMes = label; corpo.innerHTML += `<div class="section-header"><h3>${label}</h3></div>`; }
        
        corpo.innerHTML += `
        <div class="list-item ${p.paga ? 'pago' : ''}">
            <div style="width:20px; margin-right:10px;">
                <input type="checkbox" class="chk-agenda" value="${p.gid}|${p.idx}" onclick="updateSelectionCount('agenda')">
            </div>
            <div class="item-main">
                <span class="item-title">${p.desc}</span>
                <span class="item-sub">${p.idx+1}/${p.totalParc} • ${new Date(p.data+"T12:00:00").toLocaleDateString('pt-br')}</span>
            </div>
            <div class="item-side">
                <span class="item-price" style="color:${p.paga ? '#94a3b8' : 'var(--danger)'}">${fmt(p.valor)}</span>
                
                <div style="display:flex;gap:6px;margin-top:4px;">
                    <button class="btn-small ${p.paga ? 'btn-outline' : 'btn-success'}" onclick="pagar(${p.gid},${p.idx})">
                        ${p.paga ? 'Desfazer' : 'Pagar'}
                    </button>
                    <button class="btn-small btn-danger" onclick="excluirParcelaAgenda(${p.gid},${p.idx})">
                        Excluir
                    </button>
                </div>
                
            </div>
        </div>`;
    });
}

function excluirParcelaAgenda(gid, idx) {
    if(!confirm("Atenção: Deseja excluir esta parcela da agenda? O valor será removido do seu caixa e dos relatórios.")) return;
    
    let gIndex = db.out.findIndex(x => x.id == gid);
    
    if(gIndex > -1) {
        // Remove apenas a parcela específica
        db.out[gIndex].parcelas.splice(idx, 1);
        
        // Regra de segurança: se apagar a última parcela de uma compra, deleta a compra toda do sistema
        if(db.out[gIndex].parcelas.length === 0) {
            db.out.splice(gIndex, 1);
        }
        
        save();
        render(); // Recalcula o Caixa e o Dashboard imediatamente
        showToast("Parcela excluída com sucesso.");
    }
}

function openDialog(t, m, type, def, cb) {
    document.getElementById('cd-title').innerText = t; 
    document.getElementById('cd-msg').innerText = m;
    const it = document.getElementById('cd-input'), id = document.getElementById('cd-input-date');
    if(it) { it.style.display = type === 'text' ? 'block' : 'none'; if(type === 'text') it.value = def || ''; }
    if(id) id.style.display = type === 'date' ? 'block' : 'none';
    
    document.getElementById('cd-btn-ok').onclick = () => { cb(type === 'text' ? it.value : id.value); fecharDialog(); };
    document.getElementById('custom-dialog').style.display = 'flex';
}

function fecharDialog() { 
    let d = document.getElementById('custom-dialog'); 
    if(d) d.style.display = 'none'; 
}

function handleProjectChange(val) {
    if (val === 'NOVO_PROJETO') {
        openDialog("Nova Obra", "Nome:", 'text', "", (n) => {
            if(n && !appData.projects[n]) { appData.projects[n] = defaultDb(n); appData.current = n; db = appData.projects[n]; save(); render(); }
        });
    } else { appData.current = val; db = appData.projects[val]; save(); render(); }
}

function renameProject() {
    openDialog("Renomear", "Novo nome:", 'text', db.projectName, (n) => {
        if(n && n !== db.projectName) {
            let old = appData.current; db.projectName = n; appData.projects[n] = db; delete appData.projects[old]; appData.current = n; save(); render();
        }
    });
}

function renderFluxo(caixaAtual) {
    const corpo = document.getElementById('corpo-fluxo'); 
    if(!corpo) return;
    corpo.innerHTML = '';
    let ac = caixaAtual - getRawValue('sim-val');
    for(let i=0; i<12; i++) {
        let d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
        let sIn = db.in.filter(x => new Date(x.data+"T12:00:00").getMonth() === d.getMonth() && new Date(x.data+"T12:00:00").getFullYear() === d.getFullYear()).reduce((a,b)=>a+b.valor,0);
        let sOut = 0; db.out.forEach(g => (g.parcelas||[]).forEach(p => { let dp = new Date(p.data+"T12:00:00"); if(!p.paga && dp.getMonth() === d.getMonth() && dp.getFullYear() === d.getFullYear()) sOut += p.valor; }));
        ac = (ac + sIn) - sOut;
        corpo.innerHTML += `<div class="fluxo-card" style="${ac < 0 ? 'border-color:var(--danger); background:#fff1f2' : ''}"><div class="fluxo-mes">${d.toLocaleDateString('pt-br', {month:'long', year:'2-digit'}).toUpperCase()}</div><div class="fluxo-vals">Entra: <b style="color:var(--success)">${fmt(sIn)}</b><br>Sai: <b style="color:var(--danger)">${fmt(sOut)}</b></div><div class="fluxo-saldo" style="color:${ac < 0 ? 'var(--danger)' : 'var(--primary)'}">${fmt(ac)}</div></div>`;
    }
}

function renderCotacoes(alerts, hojeStr) {
    const corpo = document.getElementById('corpo-cotacoes'); 
    if(!corpo) return;
    corpo.innerHTML = '';
    db.cot.forEach(c => {
        corpo.innerHTML += `<div class="list-item" style="flex-direction:column; align-items:flex-start;"><div style="display:flex; justify-content:space-between; width:100%;"><div class="item-main"><span class="item-title">${c.desc}</span><span class="item-sub">${c.status}</span></div><div class="item-side"><span class="item-price">${c.valor ? fmt(c.valor) : 'Pendente'}</span></div></div><div class="buttons-row" style="margin-top: 15px;">${c.status === 'A Orçar' ? `<button class="btn-action btn-outline btn-small" style="flex:1" onclick="agendarVisita(${c.id})">📅 VISITAR</button><button class="btn-action btn-warning btn-small" style="flex:1" onclick="abrirModal('cot-edit', ${c.id})">✏️ ORÇAR</button>` : `<button class="btn-action btn-success btn-small" style="flex:2" onclick="abrirModal('out', ${c.id})">🛒 COMPRAR</button>`}</div></div>`;
    });
}

function agendarVisita(cid) { let c = db.cot.find(x => x.id == cid); if(!c) return; openDialog("Visita", `Data para: ${c.desc}`, 'date', '', (d) => { if(d) { c.dataVisita = d; save(); render(); } }); }
function removerVisita(cid) { let c = db.cot.find(x => x.id == cid); if(c) { c.dataVisita = ''; save(); render(); } }

function updateStatusBar(saldoLivre, alerts, criticalCount) {
    const bar = document.getElementById('status-bar'), icon = document.getElementById('sb-icon'), text = document.getElementById('sb-text'), cont = document.getElementById('sb-alerts-container');
    if(!bar) return;
    if(saldoLivre < 0) { bar.className = "status-bar sb-critical"; icon.innerText = "🚨"; text.innerText = "CAIXA NEGATIVO!"; } 
    else if(criticalCount > 0) { bar.className = "status-bar sb-critical"; icon.innerText = "⚠️"; text.innerText = "PENDÊNCIAS ATRASADAS!"; } 
    else if(alerts.length > 0) { bar.className = "status-bar sb-alert"; icon.innerText = "🔔"; text.innerText = "AVISOS HOJE:"; } 
    else { bar.className = "status-bar sb-ok"; icon.innerText = "✅"; text.innerText = "SISTEMA OK."; }
    if(cont) cont.innerHTML = alerts.slice(0, 3).join('');
}

function checkProviderMemory(nome) { if(!nome) return; const last = db.out.slice().reverse().find(g => g.fornecedor && g.fornecedor.toLowerCase() === nome.toLowerCase()); if(last && !document.getElementById('m-tel').value) document.getElementById('m-tel').value = last.tel || ''; }

function abrirModal(t, idOrig = null, valorPre = null) {
    document.getElementById('m-tipo').value = t; 
    let mIdOrig = document.getElementById('m-id-orig');
    if(mIdOrig) mIdOrig.value = idOrig;
    
    // Mostra/Oculta Divs
    ["m-div-cat-out", "m-div-forn", "m-div-finan"].forEach(i => { let el=document.getElementById(i); if(el) el.style.display = 'block'; });
    ["m-div-cat-in", "m-div-in-freq", "m-div-budget"].forEach(i => { let el=document.getElementById(i); if(el) el.style.display = 'none'; });
    
    if(t === 'in') { 
        ["m-div-cat-out", "m-div-forn", "m-div-finan"].forEach(i => { let el=document.getElementById(i); if(el) el.style.display = 'none'; }); 
        ["m-div-cat-in", "m-div-in-freq"].forEach(i => { let el=document.getElementById(i); if(el) el.style.display = 'block'; }); 
    }
    else if(t === 'cot-new') { 
        let fin = document.getElementById('m-div-finan'); if(fin) fin.style.display = 'none'; 
        let bdg = document.getElementById('m-div-budget'); if(bdg) bdg.style.display = 'block'; 
    }
    
    let elAmb = document.getElementById('m-amb');
    if(elAmb) elAmb.innerHTML = db.ambs.map(a => `<option value="${a}">${a}</option>`).join('') + '<option value="ADD_NEW">+ NOVO...</option>';
    
    let elCat = document.getElementById('m-cat');
    if(elCat) elCat.innerHTML = db.cats.map(c => `<option value="${c}">${c}</option>`).join('') + '<option value="ADD_NEW">+ NOVA...</option>';
    
    let elCartao = document.getElementById('m-cartao');
    if(elCartao) elCartao.innerHTML = db.cards.map(c => `<option value="${c.nome || c.cartao || ''}">${c.nome || c.cartao || ''}</option>`).join('');
    
    ["m-desc","m-valor","m-data","m-forn","m-tel","m-obs","m-budget","m-novo-amb","m-novo-cat"].forEach(i => { let el=document.getElementById(i); if(el) el.value = ''; });
    
    let mData = document.getElementById('m-data');
    if(mData) mData.value = hoje.toISOString().split('T')[0];
    
    // --- LÓGICA NOVA: PREENCHER OS DADOS SE FOR EDIÇÃO ---
    if (idOrig) {
        let item = null;
        if (t === 'in') item = db.in.find(x => x.id == idOrig);
        if (t === 'out' || t === 'out-edit') item = db.out.find(x => x.id == idOrig);
        if (t === 'cot-edit') item = db.cot.find(x => x.id == idOrig);

        if (item) {
            let dDesc = document.getElementById('m-desc'); if(dDesc) dDesc.value = item.desc || '';
            let dValor = document.getElementById('m-valor'); if(dValor) dValor.value = (item.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            let dObs = document.getElementById('m-obs'); if(dObs) dObs.value = item.obs || '';

            if (t === 'in') {
                let dCatIn = document.getElementById('m-cat-in'); if(dCatIn) dCatIn.value = item.cat || '';
                if(mData) mData.value = item.data || '';
            } 
            else if (t === 'out' || t === 'out-edit') {
                if(elCat) elCat.value = item.cat || '';
                if(elAmb) elAmb.value = item.amb || '';
                let dForn = document.getElementById('m-forn'); if(dForn) dForn.value = item.fornecedor || '';
                let dTel = document.getElementById('m-tel'); if(dTel) dTel.value = item.tel || '';
                let dMetodo = document.getElementById('m-metodo'); if(dMetodo) dMetodo.value = item.metodo || 'Dinheiro';
                if(elCartao && item.metodo === 'Cartão de Crédito') elCartao.value = item.cartao || '';
                
                if (item.parcelas && item.parcelas.length > 0) {
                    let dQtd = document.getElementById('m-qtd'); if(dQtd) dQtd.value = item.parcelas.length;
                    if(mData) mData.value = item.parcelas[0].data;
                    let mDataI = document.getElementById('m-data-i'); if(mDataI) mDataI.value = item.parcelas[0].data;
                }
            }
        }
    } 
    else if (valorPre) { 
        let mVal = document.getElementById('m-valor'); if(mVal) mVal.value = valorPre.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); 
        let mDesc = document.getElementById('m-desc'); if(mDesc) mDesc.value = "Ajuste de Saldo"; 
        if(elCat) elCat.value = 'Ajuste de Saldo'; 
        let catIn = document.getElementById('m-cat-in'); if(t === 'in' && catIn) catIn.value = 'Ajuste de Saldo'; 
    }

    const catIn = document.getElementById('m-cat-in');
    const catOut = document.getElementById('m-cat');
    if((t === 'in' && catIn && catIn.value === 'Ajuste de Saldo') || (t === 'out' && catOut && catOut.value === 'Ajuste de Saldo')){
        ['m-div-forn', 'm-div-finan', 'm-div-amb', 'm-div-budget'].forEach(id => {
            let e = document.getElementById(id); if(e) e.style.display='none';
        });
    }

    toggleCondicao(); toggleMetodo(); calcTudo(); 
    let mdl = document.getElementById('modal');
    if(mdl) mdl.style.display = 'flex';
}

function fecharModal() { let el = document.getElementById('modal'); if(el) el.style.display = 'none'; }
function toggleNovaCat() { let c = document.getElementById('m-cat'); let n = document.getElementById('m-novo-cat'); if(n && c) n.style.display = c.value === 'ADD_NEW' ? 'block' : 'none'; }
function toggleNovoAmb() { let a = document.getElementById('m-amb'); let n = document.getElementById('m-novo-amb'); if(n && a) n.style.display = a.value === 'ADD_NEW' ? 'block' : 'none'; }
function toggleMetodo() { let m = document.getElementById('m-metodo'); let d = document.getElementById('div-cartao-nome'); if(d && m) d.style.display = m.value === 'Cartão de Crédito' ? 'block' : 'none'; }
function toggleCondicao() { let p = document.getElementById('m-pagto'); if(!p) return; const v = p.value; ["d-parc", "d-perc", "d-mix"].forEach(i => { let el=document.getElementById(i); if(el) el.style.display = i === 'd-'+v ? 'block' : 'none'; }); }
function toggleInFreqOptions() { let f = document.getElementById('in-freq'); if(!f) return; let v = f.value; let w = document.getElementById('div-in-weeks'); if(w) w.style.display = v === 'semanal' ? 'block' : 'none'; let m = document.getElementById('div-in-months'); if(m) m.style.display = v === 'mensal' ? 'block' : 'none'; }

function calcTudo() {
    const v = getRawValue('m-valor'); 
    let mqtd = document.getElementById('m-qtd');
    const q = mqtd ? parseInt(mqtd.value) || 1 : 1; 
    let pfv = document.getElementById('parc-fixa-val'); if(pfv) pfv.innerText = fmt(v / q);
    
    let p1perc = document.getElementById('p1-perc');
    const p1 = p1perc ? parseFloat(p1perc.value) || 0 : 0; 
    let p2perc = document.getElementById('p2-perc'); if(p2perc) p2perc.value = 100 - p1; 
    let p1val = document.getElementById('p1-val-label'); if(p1val) p1val.innerText = fmt(v * (p1/100)); 
    let p2val = document.getElementById('p2-val-label'); if(p2val) p2val.innerText = fmt(v * ((100-p1)/100));
    
    let msp = document.getElementById('mix-sinal-p');
    const ms = msp ? parseFloat(msp.value) || 0 : 0; 
    let mpq = document.getElementById('mix-parc-qtd');
    const mq = mpq ? parseInt(mpq.value) || 1 : 1; 
    let msv = document.getElementById('mix-sinal-v'); if(msv) msv.innerText = fmt(v * (ms/100)); 
    let mpv = document.getElementById('mix-parc-v'); if(mpv) mpv.innerText = fmt((v * (1 - (ms/100))) / mq);
}

function salvar() {
    const t = document.getElementById('m-tipo').value;
    const idOrig = document.getElementById('m-id-orig').value;
    const val = getRawValue('m-valor');
    if (t !== 'cot-new' && val <= 0) return;

    let ambEl = document.getElementById('m-amb');
    let amb = ambEl ? ambEl.value : ''; 
    if(amb === 'ADD_NEW') { amb = document.getElementById('m-novo-amb').value; db.ambs.push(amb); }
    
    let cat = (t === 'in') ? document.getElementById('m-cat-in').value : document.getElementById('m-cat').value; 
    if(cat === 'ADD_NEW') { cat = document.getElementById('m-novo-cat').value; db.cats.push(cat); }
    
    // LÓGICA NOVA: Se for edição, mantém o ID original
    let realId = idOrig ? parseInt(idOrig) : Date.now();

    const base = { id: realId, desc: document.getElementById('m-desc').value, amb: amb, cat: cat, valor: val, obs: document.getElementById('m-obs').value, fornecedor: document.getElementById('m-forn').value, tel: document.getElementById('m-tel').value, parcelas: [] };

    if (t === 'out' || t === 'out-edit') {
        const pag = document.getElementById('m-pagto').value; 
        let dMetodo = document.getElementById('m-metodo');
        base.metodo = dMetodo ? dMetodo.value : 'Dinheiro'; 
        let cartaoEl = document.getElementById('m-cartao');
        base.cartao = cartaoEl ? cartaoEl.value : '';

        if(pag === 'parc') { 
            let q = parseInt(document.getElementById('m-qtd').value);
            let dP = (base.metodo === 'Cartão de Crédito') ? document.getElementById('m-data').value : document.getElementById('m-data-i').value; 
            for(let i=0; i<q; i++) { 
                let d = new Date(dP + "T12:00:00"); 
                d.setMonth(d.getMonth() + i); 
                base.parcelas.push({ data: d.toISOString().split('T')[0], valor: val/q, paga: false }); 
            } 
        }
        else if(pag === 'perc') { 
            base.parcelas.push({ data: document.getElementById('p1-data').value, valor: val * (parseFloat(document.getElementById('p1-perc').value)/100), paga: false }); 
            base.parcelas.push({ data: document.getElementById('p2-data').value, valor: val * (parseFloat(document.getElementById('p2-perc').value)/100), paga: false }); 
        }
        else { 
            let sP = parseFloat(document.getElementById('mix-sinal-p').value)/100; 
            base.parcelas.push({ data: document.getElementById('mix-sinal-d').value, valor: val * sP, paga: false }); 
            let q = parseInt(document.getElementById('mix-parc-qtd').value); 
            for(let i=0; i<q; i++) { 
                let d = new Date(document.getElementById('mix-parc-d').value + "T12:00:00"); 
                d.setMonth(d.getMonth() + i); 
                base.parcelas.push({ data: d.toISOString().split('T')[0], valor: (val * (1-sP))/q, paga: false }); 
            } 
        }
        
        // LÓGICA NOVA: Apaga o registro antigo para evitar duplicação antes de injetar a atualização
        if((t === 'out' || t === 'out-edit') && idOrig) {
            db.out = db.out.filter(x => x.id != idOrig);
        }
        
        db.out.push(base); 
        
        // Se a pessoa aprovou um orçamento, deleta de orçamentos e vira gasto
        if (idOrig && t === 'out') db.cot = db.cot.filter(x => x.id != idOrig);
        
        if(base.cat !== "Ajuste de Saldo") abrirLogistica(base.id);
        
    } else if (t === 'cot-edit') { 
        let idx = db.cot.findIndex(x => x.id == idOrig); 
        if(idx > -1) { db.cot[idx].valor = val; db.cot[idx].status = 'Orçado'; } 
    }
    else if (t === 'in') { 
        base.data = document.getElementById('m-data').value; 
        
        // LÓGICA NOVA: Apaga a entrada antiga antes de salvar a edição
        if (idOrig) {
            db.in = db.in.filter(x => x.id != idOrig);
        }
        
        db.in.push(base); 
    }
    else if (t === 'cot-new') { 
        base.data = document.getElementById('m-data').value; 
        base.status = 'A Orçar'; 
        base.budget = getRawValue('m-budget'); 
        db.cot.push(base); 
    }
    
    save(); fecharModal(); render();
}

function abrirLogistica(gid) { document.getElementById('ml-gid').value = gid; document.getElementById('modal-logistica').style.display = 'flex'; }
function toggleJanelaLogistica() { const t = document.getElementById('ml-tipo-data').value; document.getElementById('ml-div-fixa').style.display = t === 'fixa' ? 'block' : 'none'; document.getElementById('ml-div-janela').style.display = t === 'janela' ? 'block' : 'none'; }
function salvarAgendamentoLogistica() {
    const gid = document.getElementById('ml-gid').value, g = db.out.find(x => x.id == gid), t = document.getElementById('ml-tipo-data').value;
    g.dataEntrega = t === 'fixa' ? document.getElementById('ml-data-unica').value : document.getElementById('ml-data-ini').value; g.dataEntregaFim = t === 'janela' ? document.getElementById('ml-data-fim').value : ''; g.entregue = false; save(); document.getElementById('modal-logistica').style.display = 'none'; render();
}

function addNovoCartao() { const n = document.getElementById('nc-nome').value, f = document.getElementById('nc-fech').value, v = document.getElementById('nc-venc').value; if(!n || !f || !v) return; db.cards.push({ nome: n, fechamento: parseInt(f), vencimento: parseInt(v) }); save(); renderCartaoConfig(); document.getElementById('nc-nome').value = ''; }
function excluirCartao(idx) {
    if(confirm("ATENÇÃO: Deseja realmente excluir este cartão da sua lista?")) {
        db.cards.splice(idx, 1);
        save();
        renderCartaoConfig();
        render(); // Atualiza a tela de trás caso seja necessário
    }
}

function renderCartaoConfig() { 
    let lista = document.getElementById('lista-cartoes-config');
    if(!lista) return;
    
    lista.innerHTML = db.cards.map((car, idx) => `
        <div style="background:#fff; padding:10px; border-radius:10px; margin-bottom:5px; display:flex; justify-content:space-between; align-items:center; border:1px solid #eee">
            <span style="font-weight:900">${car.nome} (F:${car.fechamento}/V:${car.vencimento})</span>
            <button onclick="excluirCartao(${idx})" style="color:var(--danger); background:none; border:none; font-weight:bold; font-size:16px; cursor:pointer;">X</button>
        </div>`
    ).join('') || 'Sem cartões.'; 
}function abrirModalCartao() { renderCartaoConfig(); document.getElementById('modal-config-cartao').style.display = 'flex'; }
function updateSelectionCount(ctx) { const n = document.querySelectorAll(`.chk-${ctx}:checked`).length; let b = document.getElementById(`bulk-${ctx}`); if(b) b.style.display = n > 0 ? 'flex' : 'none'; }
function bulkExecute(ctx, act) {
    const sel = Array.from(document.querySelectorAll(`.chk-${ctx}:checked`)).map(c => c.value);
    openDialog("Bulk", `Executar em ${sel.length}?`, 'none', null, () => {
        if(ctx === 'agenda') sel.forEach(v => { const [id, idx] = v.split('|'); let g = db.out.find(x=>x.id==id); if(act==='pagar') g.parcelas[idx].paga=true; else g.parcelas.splice(idx,1); });
        else if(act==='deletar') db.out = db.out.filter(g => !sel.includes(g.id.toString()));
        save(); render();
    });
}

function exportarDados() { save(); const a = document.createElement('a'); a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appData)); a.download = `elite_backup.json`; a.click(); }
function importarDados(inp) { const r = new FileReader(); r.onload = (e) => { appData = JSON.parse(e.target.result); db = appData.projects[appData.current]; save(); render(); }; r.readAsText(inp.files[0]); }
function exportarCSV() { let csv = "Tipo,Data,Descricao,Valor,Status\n"; db.out.forEach(g => (g.parcelas||[]).forEach(p => csv += `Saida,${p.data},"${g.desc}",${p.valor},${p.paga?'Pago':'Pendente'}\n`)); const a = document.createElement('a'); a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv); a.download = `relatorio.csv`; a.click(); }
function updateGlobal() { db.saldoInicial = getRawValue('dash-saldo'); db.dataSaldoInicial = document.getElementById('dash-data-saldo').value; save(); render(); }
function updateDeliveryDate(v) { db.deliveryDate = v; save(); render(); }
function mudarMes(s) { calMes += s; if(calMes > 11) { calMes = 0; calAno++; } if(calMes < 0) { calMes = 11; calAno--; } render(); }

function abrirModalRetirada() {
    const sel = document.getElementById('r-vinc-gasto'); sel.innerHTML = '<option value="">Não vincular</option>';
    db.out.forEach(g => sel.innerHTML += `<option value="${g.id}">${g.desc}</option>`);
    document.getElementById('r-desc').value = ''; document.getElementById('r-valor').value = ''; document.getElementById('r-data').value = hoje.toISOString().split('T')[0];
    document.getElementById('modal-retirada').style.display = 'flex';
}
function sugerirValorEstorno(gid) { if(!gid) return; const g = db.out.find(x => x.id == gid); if(g) { document.getElementById('r-valor').value = g.valor.toLocaleString('pt-br', {style:'currency', currency:'BRL'}); document.getElementById('r-desc').value = `Estorno ${g.desc}`; } }
function salvarRetirada() {
    const val = getRawValue('r-valor'); if(val <= 0) return;
    db.retiradas.push({ id: Date.now(), desc: document.getElementById('r-desc').value, data: document.getElementById('r-data').value, valor: val, vinculo: document.getElementById('r-vinc-gasto').value, concluida: false });
    save(); render(); document.getElementById('modal-retirada').style.display = 'none';
}

function toggleNovoMenu(){
    const el = document.getElementById('novo-dropdown');
    if(!el) return;
    el.style.display = el.style.display === 'flex' ? 'none' : 'flex';
}

// ==========================================================================
// FUNÇÕES DE EDIÇÃO E FORMATAÇÃO (REESCRITAS E APLICADAS)
// ==========================================================================

function renderEntradas(){
    const corpo = document.getElementById('corpo-entradas');
    if(!corpo) return;
    corpo.innerHTML = '';
    
    // ORDENAÇÃO: Data mais antiga (menor) para a mais recente
    db.in.sort((a,b) => new Date(a.data) - new Date(b.data)).forEach(i=>{
        let isPago = new Date(i.data + "T23:59:59") <= hoje;
        corpo.innerHTML += `
        <div class="list-item ${isPago ? 'pago' : ''}">
            <div class="item-main">
                <span class="item-title">${i.desc}</span>
                <span class="item-sub">${new Date(i.data+"T12:00:00").toLocaleDateString("pt-br")} • ${i.cat}</span>
            </div>
            <div class="item-side">
                <span class="item-price" style="color:var(--success)">+ ${fmt(i.valor)}</span>
                <div style="display:flex;gap:4px;margin-top:4px">
                    <button class="btn-small btn-outline" onclick="editarEntrada(${i.id})">Editar</button>
                    <button class="btn-small btn-danger" onclick="excluirEntrada(${i.id})">Excluir</button>
                </div>
            </div>
        </div>`;
    });
}
function editarEntrada(id){
    let i = db.in.find(x=>x.id==id);
    if(!i) return;
    abrirModal('in', id);
}

function excluirEntrada(id){
    if(!confirm('Deseja realmente excluir esta entrada?')) return;
    db.in = db.in.filter(x=>x.id!=id);
    save(); render();
}

function renderGastos() {
    const corpo = document.getElementById('corpo-gastos');
    if(!corpo) return;
    corpo.innerHTML = '';
    
    // Pega o filtro da categoria selecionada
    const catEl = document.getElementById('filtro-cat');
    const cat = catEl ? catEl.value : '';

    // Filtra a lista de gastos (agora sem procurar a caixa de texto)
    let lista = db.out
        .filter(g => (cat === "" || g.cat === cat))
        .sort((a,b)=> new Date(a.parcelas?.[0]?.data || 0) - new Date(b.parcelas?.[0]?.data || 0));

    let totalFiltrado = 0; // Variável para somar o total

    lista.forEach(g => {
        totalFiltrado += g.valor; // Soma o valor de cada gasto que aparece
        
        const data = g.parcelas?.[0]?.data ? new Date(g.parcelas[0].data+"T12:00:00").toLocaleDateString('pt-BR') : "";
        const parc = g.parcelas ? g.parcelas.length + "x" : "1x";
        
        corpo.innerHTML += `
        <div class="list-item">
            <div class="item-main">
                <span class="item-title">${data} • <b>${g.desc}</b></span>
                <span class="item-sub">${parc} • ${g.cat || ''}</span>
            </div>
            <div class="item-side">
                <span class="item-price">${fmt(g.valor)}</span>
                <div style="display:flex;gap:6px;margin-top:4px;">
                    <button class="btn-small btn-outline" onclick="abrirModal('out-edit', ${g.id})">Editar</button>
                    <button class="btn-small btn-danger" onclick="excluirGasto(${g.id})">Excluir</button>
                </div>
            </div>
        </div>`;
    });

    // Atualiza a nova caixinha do Total que adicionámos no HTML
    let totalLabel = document.getElementById('total-gastos-label');
    if(totalLabel) {
        totalLabel.innerText = fmt(totalFiltrado);
    }

    const sc = document.getElementById('filtro-cat');
    if(sc && sc.options.length <= 1){
        db.cats.forEach(c => sc.innerHTML += `<option value="${c}">${c}</option>`);
    }
}

function excluirGasto(id){
    if(!confirm("Deseja realmente excluir este gasto?")) return;
    db.out = db.out.filter(g => g.id !== id);
    save(); render(); showToast("Gasto excluído.");
}

function calcularMesFatura(dataCompra, cartaoNome){
    const compra = new Date(dataCompra+"T12:00:00");
    let card = (db.cards||[]).find(c => (c.nome||c.cartao) === cartaoNome);
    if(!card){ return compra.toLocaleDateString('pt-BR',{month:'long',year:'numeric'}).toUpperCase(); }

    const fechamento = parseInt(card.fechamento || card.fech || 1);
    let mes = compra.getMonth();
    let ano = compra.getFullYear();

    if(compra.getDate() > fechamento){
        mes += 1;
        if(mes>11){ mes = 0; ano += 1; }
    }
    const dt = new Date(ano, mes, 1);
    return dt.toLocaleDateString('pt-BR',{month:'long',year:'numeric'}).toUpperCase();
}

function renderCartao(){
    const corpo=document.getElementById("corpo-cartao");
    const hist=document.getElementById("corpo-cartao-historico");
    if(!corpo) return;
    corpo.innerHTML="";
    if(hist) hist.innerHTML="";

    let faturas={};
    (db.out||[]).forEach(g=>{
        if(g.metodo!=="Cartão de Crédito") return;
        (g.parcelas||[]).forEach(p=>{
            if(p.paga) return;
            let mes=calcularMesFatura(p.data,g.cartao);
            let key=g.cartao+"_"+mes;
            if(!faturas[key]){ faturas[key]={cartao:g.cartao,mes:mes,total:0}; }
            faturas[key].total+=p.valor;
        });
    });

    Object.values(faturas).forEach(f=>{
        corpo.innerHTML+=`
        <div class="list-item">
            <div class="item-main">
                <span class="item-title">${f.cartao}</span>
                <span class="item-sub">${f.mes}</span>
            </div>
            <div class="item-side">
                <span class="item-price">${fmt(f.total)}</span>
                <button class="btn-action btn-success btn-small" onclick="pagarFatura('${f.cartao}','${f.mes}')">PAGAR</button>
            </div>
        </div>`;
    });

    (db.faturasPagas||[]).forEach(f=>{
        hist.innerHTML+=`
        <div class="list-item pago">
            <div class="item-main">
                <span class="item-title">${f.cartao}</span>
                <span class="item-sub">${f.mes}</span>
            </div>
            <div class="item-side">
                <span class="item-price">${fmt(f.valorTotal)}</span>
            </div>
        </div>`;
    });
}

function pagarFatura(cartao,mes){
    let totalMes=0;
    let totalCartao=0;

    (db.out||[]).forEach(g=>{
        if(g.metodo!=="Cartão de Crédito") return;
        if(g.cartao!==cartao) return;
        (g.parcelas||[]).forEach(p=>{
            if(p.paga) return;
            let mf=calcularMesFatura(p.data,g.cartao);
            totalCartao+=p.valor;
            if(mf===mes){ totalMes+=p.valor; }
        });
    });

    openDialog(
        "Pagamento da Fatura",
        "Fatura do mês: "+fmt(totalMes)+"\nTotal futuro do cartão: "+fmt(totalCartao)+"\nDigite o valor pago:",
        "text",
        fmt(totalMes),
        function(v){
            let pago=getRawValue({value:v});
            let diff=pago-totalMes;

            (db.out||[]).forEach(g=>{
                if(g.cartao!==cartao) return;
                (g.parcelas||[]).forEach(p=>{
                    let mf=calcularMesFatura(p.data,g.cartao);
                    if(mf===mes && !p.paga){ p.paga=true; }
                });
            });

            if(Math.abs(diff)>0.01){
                if(diff>0){
                    db.out.push({ id:Date.now(), desc:"Ajuste Fatura Cartão", cat:"Ajuste de Saldo", valor:diff, metodo:"Dinheiro", parcelas:[{ valor:diff, data:new Date().toISOString().slice(0,10), paga:true }] });
                }else{
                    db.in.push({ id:Date.now(), desc:"Ajuste Fatura Cartão", cat:"Ajuste de Saldo", valor:Math.abs(diff), data:new Date().toISOString().slice(0,10) });
                }
            }

            if(!db.faturasPagas) db.faturasPagas=[];
            db.faturasPagas.push({ cartao:cartao, mes:mes, valorTotal:pago, data:new Date().toISOString().slice(0,10) });

            save(); render();
        }
    );

    setTimeout(()=>{
        let input=document.getElementById("cd-input");
        if(input){ input.oninput=()=>formatCurrencyMask(input); formatCurrencyMask(input); }
    },50);
}

function reconciliarCaixa(){
    let atualStr = document.getElementById("card-caixa").innerText;

    openDialog(
        "Conciliar Caixa",
        "Saldo atual calculado: "+atualStr+"\nDigite o valor real do caixa agora:",
        "text",
        atualStr,
        function(v){
            if(!v) return;
            let real = getRawValue({value:v});
            let atual = parseFloat(atualStr.replace(/\D/g,''))/100;
            let diff = real - atual;

            if(Math.abs(diff) < 0.01){ showToast("Caixa já está conciliado."); return; }

            let hoje = new Date().toISOString().slice(0,10);

            if(diff > 0){
                db.in.push({ id:Date.now(), desc:"Conciliação de Caixa", cat:"Ajuste de Saldo", valor:diff, data:hoje, origem:"CONCILIACAO_CAIXA" });
            }else{
                db.out.push({ id:Date.now(), desc:"Conciliação de Caixa", cat:"Ajuste de Saldo", valor:Math.abs(diff), metodo:"Dinheiro", origem:"CONCILIACAO_CAIXA", parcelas:[{ valor:Math.abs(diff), data:hoje, paga:true }] });
            }

            save(); render(); showToast("Caixa conciliado com sucesso.");
        }
    );

    setTimeout(()=>{
        let input=document.getElementById("cd-input");
        if(input){ input.oninput=()=>formatCurrencyMask(input); formatCurrencyMask(input); }
    },50);
}

function abrirAjusteSaldo(){
    let atualStr = document.getElementById("card-caixa").innerText;

    openDialog(
        "Ajustar Caixa",
        "Saldo atual calculado: "+atualStr+"\nDigite o valor real do caixa:",
        "text",
        atualStr,
        function(v){
            if(!v) return;
            let real = getRawValue({value:v});
            let atual = parseFloat(atualStr.replace(/\D/g,''))/100;
            let diff = real - atual;

            if(Math.abs(diff) < 0.01){ showToast("Caixa já está correto."); return; }

            let d = new Date();
            d.setDate(d.getDate()-1);
            let ontem = d.toISOString().slice(0,10);

            if(diff > 0){
                db.in.push({ id:Date.now(), desc:"Ajuste de Caixa", cat:"Ajuste de Saldo", valor:diff, data:ontem, origem:"AJUSTE_CAIXA" });
            }
            if(diff < 0){
                db.out.push({ id:Date.now(), desc:"Ajuste de Caixa", cat:"Ajuste de Saldo", valor:Math.abs(diff), metodo:"Dinheiro", origem:"AJUSTE_CAIXA", parcelas:[{ data:ontem, valor:Math.abs(diff), paga:true }] });
            }

            save(); render(); showToast("Caixa ajustado.");
        }
    );

    setTimeout(()=>{
        let input=document.getElementById("cd-input");
        if(input){ input.oninput=()=>formatCurrencyMask(input); formatCurrencyMask(input); }
    },50);
}

function validarCaixaAgora(){ reconciliarCaixa(); }

// ==========================================================================
// CAMADA DE ESTABILIDADE
// ==========================================================================
window.addEventListener("error", function(e){
    console.error("Erro capturado:", e.error);
});

try {
    if(typeof render === "function") render();
} catch(e) {
    console.error("Erro inicial:", e);
}
function abrirModalGrafico() {
    document.getElementById('modal-grafico').style.display = 'flex';
    // Precisamos de um pequeno tempo para o modal aparecer antes de desenhar o gráfico
    setTimeout(() => {
        updateExpenseChart();
    }, 100);
}
function updateExpenseChart() {
    const ctx = document.getElementById('expenseChart');
    if (!ctx) return;

    const categoryData = {};
    db.out.forEach(g => {
        const cat = g.cat || 'Sem Categoria';
        if (!categoryData[cat]) {
            categoryData[cat] = { pago: 0, pendente: 0 };
        }
        (g.parcelas || []).forEach(p => {
            if (p.paga) categoryData[cat].pago += p.valor;
            else categoryData[cat].pendente += p.valor;
        });
    });

    const sortedCats = Object.entries(categoryData)
        .sort((a, b) => (b[1].pago + b[1].pendente) - (a[1].pago + a[1].pendente));
    
    const labels = sortedCats.map(item => item[0]);
    const dataPago = sortedCats.map(item => item[1].pago);
    const dataPendente = sortedCats.map(item => item[1].pendente);

    if (expenseChartInstance) {
        expenseChartInstance.destroy();
    }

    expenseChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Pago', data: dataPago, backgroundColor: '#059669', borderRadius: 4 },
                { label: 'A Pagar', data: dataPendente, backgroundColor: '#dc2626', borderRadius: 4 }
            ]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { font: { size: 11, weight: '800' } } },
                tooltip: { callbacks: { label: (item) => ` ${item.dataset.label}: ${fmt(item.raw)}` } }
            },
            scales: {
                x: { stacked: true, grid: { display: false } },
                y: { stacked: true, grid: { display: false }, ticks: { font: { size: 10, weight: '700' } } }
            }
        }
    });
}
// Registro do Service Worker para transformar em APP
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
    .then(() => console.log("Elite ERP: Modo App Ativado (Offline Ready)"))
    .catch((err) => console.log("Erro ao ativar modo App:", err));
}
