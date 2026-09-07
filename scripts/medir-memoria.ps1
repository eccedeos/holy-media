<#
.SYNOPSIS
    Mede a memoria do Holy Media no Windows.

.DESCRIPTION
    Soma os dois numeros que interessam, com o aplicativo aberto e parado:

      * Working set        -- inclui memoria compartilhada, contada uma vez em
                              cada processo. Superestima, e muito, quando o
                              WebView2 espalha o mesmo runtime por varios
                              processos.
      * Working set privado -- desconta o que os processos compartilham. E' o
                              numero que diz quanta memoria o aplicativo
                              realmente tira da maquina.

    Usa CIM (Win32_PerfRawData_PerfProc_Process) em vez de Get-Counter porque
    os nomes dos contadores de desempenho sao traduzidos: '\Processo(...)' em
    portugues, '\Process(...)' em ingles. As propriedades do CIM nao mudam de
    nome com o idioma do Windows.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\medir-memoria.ps1
#>

$ErrorActionPreference = 'Stop'

# O nucleo e o navegador embutido. O WebView2 sobe varios processos, e todos
# contam para o total.
$nomes = @('holy-media', 'msedgewebview2')

$processos = @()
foreach ($nome in $nomes) {
    $processos += Get-Process -Name $nome -ErrorAction SilentlyContinue
}
if (-not $processos) {
    Write-Host 'O Holy Media nao esta em execucao.' -ForegroundColor Yellow
    Write-Host 'Abra o aplicativo, espere a janela terminar de carregar e rode de novo.'
    exit 1
}

# WorkingSetPrivate so' existe na tabela de desempenho, nao em Get-Process.
# O contador indexa por nome de imagem, com sufixo (#1, #2...) para repetidos,
# entao o cruzamento e' feito pelo id do processo.
$privadoPorId = @{}
Get-CimInstance Win32_PerfRawData_PerfProc_Process |
    Where-Object { $_.IDProcess -gt 0 } |
    ForEach-Object { $privadoPorId[[int]$_.IDProcess] = [double]$_.WorkingSetPrivate }

$linhas = foreach ($p in $processos | Sort-Object ProcessName, Id) {
    $privado = $privadoPorId[[int]$p.Id]
    $privadoMB = $null
    if ($null -ne $privado) {
        $privadoMB = [math]::Round($privado / 1MB, 1)
    }

    [pscustomobject]@{
        Processo  = $p.ProcessName
        Id        = $p.Id
        TotalMB   = [math]::Round($p.WorkingSet64 / 1MB, 1)
        PrivadoMB = $privadoMB
    }
}

# Com um unico processo, o foreach devolve um escalar em vez de array, e
# `.Count` daria 1 ou nada dependendo da versao. `@(...)` normaliza.
$linhas = @($linhas)

$linhas | Format-Table -AutoSize

$total = ($linhas | Measure-Object TotalMB -Sum).Sum
$privadoTotal = ($linhas | Where-Object { $null -ne $_.PrivadoMB } |
    Measure-Object PrivadoMB -Sum).Sum

Write-Host ''
Write-Host ('Processos            : {0}' -f $linhas.Count)
Write-Host ('Working set (total)  : {0:N0} MB   <- conta memoria compartilhada' -f $total)
if ($privadoTotal -gt 0) {
    Write-Host ('Working set privado  : {0:N0} MB   <- este e o numero que vale' -f $privadoTotal) -ForegroundColor Green
} else {
    Write-Host 'Working set privado  : indisponivel (a tabela de desempenho nao respondeu).' -ForegroundColor Yellow
    Write-Host 'Alternativa: Gerenciador de Tarefas > Detalhes > botao direito no'
    Write-Host 'cabecalho > Selecionar colunas > "Conjunto de trabalho (memoria privada)".'
}

# A aceleracao por GPU muda bastante o consumo do navegador embutido, entao o
# numero so' e' comparavel se vier acompanhado desta informacao.
Write-Host ''
try {
    $gpu = Get-CimInstance Win32_VideoController |
        Select-Object -ExpandProperty Name -ErrorAction SilentlyContinue
    Write-Host ('GPU                  : {0}' -f ($gpu -join ' | '))
} catch {
    Write-Host 'GPU                  : nao identificada'
}
Write-Host ('Windows              : {0}' -f [System.Environment]::OSVersion.Version)
