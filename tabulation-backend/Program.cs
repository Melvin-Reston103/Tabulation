using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using TabulationApi.Data;
using TabulationApi.Endpoints;
using TabulationApi.Options;

var builder = WebApplication.CreateBuilder(args);

Console.WriteLine("JWT Config");
Console.WriteLine(builder.Configuration["Jwt:Key"]);
Console.WriteLine(builder.Configuration["Jwt:Issuer"]);
Console.WriteLine(builder.Configuration["Jwt:Audience"]);
Console.WriteLine(builder.Configuration["Jwt:ExpiryHours"]);

builder.Services.Configure<JwtOptions>(
    builder.Configuration.GetSection(JwtOptions.SectionName));

builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection(JwtOptions.SectionName));

var connectionString = ResolvePostgresConnectionString(builder.Configuration)
    ?? throw new InvalidOperationException(
        "No PostgreSQL connection string configured. Set 'ConnectionStrings:Default' " +
        "(via appsettings, user-secrets, or the 'ConnectionStrings__Default' environment variable), " +
        "or provide a 'DATABASE_URL' environment variable (postgres:// URI format, as used by most hosts).");

builder.Services.AddDbContext<TabulationDbContext>(options =>
    options.UseNpgsql(connectionString));

var jwtOptions = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>()
    ?? throw new InvalidOperationException("Jwt configuration section is missing.");

if (string.IsNullOrWhiteSpace(jwtOptions.Key))
{
    throw new InvalidOperationException(
        "Jwt:Key is not configured. Set it via 'dotnet user-secrets set \"Jwt:Key\" \"<random-value>\"' " +
        "in development, or the Jwt__Key environment variable in production.");
}

builder.Services
    .AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtOptions.Issuer,
            ValidAudience = jwtOptions.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.Key)),
        };
    });

builder.Services.AddAuthorization();

const string CorsPolicy = "AllowAngularApp";
builder.Services.AddCors(options =>
{
    options.AddPolicy(CorsPolicy, policy =>
        policy.AllowAnyOrigin()
            .AllowAnyHeader()
            .AllowAnyMethod());
});

builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors(CorsPolicy);
app.UseAuthentication();
app.UseAuthorization();

app.MapAuthEndpoints();
app.MapDepartmentEndpoints();
app.MapEventEndpoints();
app.MapGameEndpoints();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<TabulationDbContext>();
    await db.Database.MigrateAsync();
    await DbSeeder.SeedAsync(db);
}

app.Run();

// Resolves the Postgres connection string from config, falling back to the
// DATABASE_URL-style URI format used by Render/Railway/Heroku/Supabase, etc.
static string? ResolvePostgresConnectionString(IConfiguration configuration)
{
    var configured = configuration.GetConnectionString("Default");
    if (!string.IsNullOrWhiteSpace(configured))
    {
        return configured;
    }

    var databaseUrl = configuration["DATABASE_URL"] ?? Environment.GetEnvironmentVariable("DATABASE_URL");
    if (string.IsNullOrWhiteSpace(databaseUrl))
    {
        return null;
    }

    var uri = new Uri(databaseUrl);
    var userInfo = uri.UserInfo.Split(':', 2);
    var query = System.Web.HttpUtility.ParseQueryString(uri.Query);
    var builder = new Npgsql.NpgsqlConnectionStringBuilder
    {
        Host = uri.Host,
        Port = uri.Port > 0 ? uri.Port : 5432,
        Database = uri.AbsolutePath.TrimStart('/'),
        Username = Uri.UnescapeDataString(userInfo[0]),
        Password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : string.Empty,
        SslMode = string.Equals(query["sslmode"], "require", StringComparison.OrdinalIgnoreCase)
            ? Npgsql.SslMode.Require
            : Npgsql.SslMode.Prefer,
    };

    if (string.Equals(query["channel_binding"], "require", StringComparison.OrdinalIgnoreCase))
    {
        builder.ChannelBinding = Npgsql.ChannelBinding.Require;
    }

    return builder.ConnectionString;
}

