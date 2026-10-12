# JENSENOnline AB

Inlämningsuppgift i säker systemutveckling

Detta är en enkel webbshop som jag har byggt för uppgiften. Den har registrering, inloggning, kund- och adminroller, produkter, kundvagn och beställningar.

## Vad behövs?

.NET SDK 10 och Git. Projektet körs lokalt och använder SQLite, så ingen separat databasserver behövs.

Kontrollera .NET-versionen:

```bash
dotnet --version
```

Versionen ska börja med 10. Om .NET 10 saknas behöver den installeras först.

## Starta projektet med Git Bash (Windows)

Öppna Git Bash och kör:

```bash
git clone https://github.com/kallekaka1/inl-mings-kerhet.git
cd inl-mings-kerhet/JensenOnline/JensenOnline.Api

export ASPNETCORE_ENVIRONMENT=Development
export SeedAdmin__Email="admin@jensenonline.local"
read -rsp "Välj ett adminlösenord: " SeedAdmin__Password
echo
export SeedAdmin__Password

dotnet run --urls http://localhost:5000
```

Välj ett eget adminlösenord på minst 8 tecken med stor bokstav, liten bokstav, siffra och specialtecken. Lösenordet visas inte när det skrivs in.

Öppna sedan http://localhost:5000 i webbläsaren.

## Alternativ: Windows PowerShell

```powershell
git clone https://github.com/kallekaka1/inl-mings-kerhet.git
cd inl-mings-kerhet/JensenOnline/JensenOnline.Api

$env:ASPNETCORE_ENVIRONMENT = "Development"
$env:SeedAdmin__Email = "admin@jensenonline.local"
$env:SeedAdmin__Password = Read-Host "Välj ett adminlösenord"

dotnet run --urls http://localhost:5000
```

Öppna http://localhost:5000 i webbläsaren.

Om projektet har lämnats in som ZIP i stället för via GitHub går det också bra att packa upp ZIP-filen, öppna terminalen i mappen `JensenOnline/JensenOnline.Api` och köra kommandona från `export` respektive `$env:` ovan.

## Testa webbshoppen

Adminmejl: admin@jensenonline.local

Adminlösenord: det lösenord du själv valde vid starten.

Första gången projektet startas skapas databasen och användarrollerna automatiskt. Med en ny databas skapas även adminkontot om mejl och lösenord har angetts som ovan.

1. Logga in som administratör och lägg till några produkter.
2. Logga ut och registrera ett nytt kundkonto.
3. Logga in som kund, lägg produkter i kundvagnen och skapa en order.
4. Kontrollera att kunden kan se sina egna beställningar.
5. Kontrollera att en vanlig kund inte kan använda adminfunktionerna.

Nya användare får automatiskt rollen Customer. Adminrollen skapas inte via vanlig registrering.

## Teknik och säkerhet

Frontend: HTML, CSS och JavaScript.

Backend: ASP.NET Core Web API, C# och ASP.NET Core Identity.

Databas: SQLite, skapad automatiskt vid första starten.

Systemet har bland annat rollkontroller, validering, skydd av kundernas order och serverberäkning av produktpriser. Det är en lokal prototyp, inte en färdig webbshop med riktiga betalningar.

## Om något inte startar

Kontrollera att .NET SDK 10 är installerat och att terminalen står i mappen `JensenOnline/JensenOnline.Api`.

Om port 5000 redan används, byt `5000` till exempelvis `5001` i startkommandot och webbadressen.

Avsluta servern genom att trycka Ctrl+C i terminalen.

Obs! Om databasen redan innehåller ett adminkonto skapas inte ett nytt konto med samma mejladress när programmet startar om. Testa gärna från en ny kopia av projektet så att databasen är tom.
