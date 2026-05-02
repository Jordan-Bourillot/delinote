; ============================================================
;  DéliNote — installer customizations
;
;  STRUCTURE — important :
;  Le fichier user `installer.nsh` d'electron-builder est `!include`
;  DANS la Section "install" — tout `Var`/`Function`/`Page` au top
;  level de ce fichier serait silencieusement invalide.
;
;  Solution : on met les `Var` et `Function` dans le macro
;  `customHeader` (inséré au script-level avant la Section), et la
;  directive `Page custom` dans `customPageAfterChangeDir` (insérée
;  juste après le choix du dossier d'install).
; ============================================================

!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"

; --- Code script-level (Var + Functions) injecté avant la Section ---
!macro customHeader
  Var DnDialog
  Var DnCbDesktop
  Var DnDoDesktop

  Function DnTasksPageCreate
    ; Approche bulletproof : un simple MessageBox OUI/NON.
    ; Pas de nsDialogs (qui échoue silencieusement chez certains utilisateurs
    ; sans qu'on sache pourquoi : timing AV, version NSIS, version Windows...).
    ; Le MessageBox natif Win32 marche TOUJOURS sur toutes les machines.
    MessageBox MB_YESNO|MB_ICONQUESTION \
      "Voulez-vous créer un raccourci DéliNote sur votre Bureau ?$\n$\n(Oui = icône sur le bureau pour accéder à DéliNote en un clic — Non = pas de raccourci)" \
      /SD IDYES \
      IDYES dn_yes IDNO dn_no
    dn_yes:
      StrCpy $DnDoDesktop "1"
      Goto dn_done
    dn_no:
      StrCpy $DnDoDesktop "0"
    dn_done:
    Abort  ; on a fait le job via MessageBox, on saute la page custom NSIS
  FunctionEnd

  Function DnTasksPageLeave
    ${NSD_GetState} $DnCbDesktop $DnDoDesktop
  FunctionEnd
!macroend

; --- Valeur par défaut de la checkbox (avant que la page ne se crée) ---
!macro preInit
  StrCpy $DnDoDesktop "1"
!macroend

; --- FIX double-launch : force install per-user, supprime la page "current user / all users".
; Sans ça, NSIS affiche un choix → si "all users" choisi → UAC_RunElevated() spawn une
; seconde instance élevée et la première quitte = double-launch perçu par l'utilisateur.
; perMachine: false dans package.json + ce macro = install per-user transparent, sans UAC.
!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend

; --- Insertion de la page custom APRÈS le choix du dossier d'installation ---
!macro customPageAfterChangeDir
  Page custom DnTasksPageCreate DnTasksPageLeave
!macroend

; --- Création réelle du raccourci selon le choix utilisateur ---
!macro customInstall
  ${If} $DnDoDesktop == "1"
    CreateShortCut "$DESKTOP\${PRODUCT_FILENAME}.lnk" "$INSTDIR\${PRODUCT_FILENAME}.exe" "" "$INSTDIR\${PRODUCT_FILENAME}.exe" 0
  ${EndIf}
!macroend

; --- Nettoyage à la désinstallation ---
!macro customUnInstall
  Delete "$DESKTOP\${PRODUCT_FILENAME}.lnk"
!macroend
