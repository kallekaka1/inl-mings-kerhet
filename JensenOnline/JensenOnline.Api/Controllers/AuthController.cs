
using System.ComponentModel.DataAnnotations;
using JensenOnline.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace JensenOnline.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _users;
    private readonly SignInManager<ApplicationUser> _signIn;

    public AuthController(
        UserManager<ApplicationUser> users,
        SignInManager<ApplicationUser> signIn)
    {
        _users = users;
        _signIn = signIn;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest request)
    {
        var email = request.Email.Trim();

        var user = new ApplicationUser
        {
            UserName = email,
            Email = email
        };

        var result = await _users.CreateAsync(
            user, request.Password);

        if (!result.Succeeded)
            return BadRequest(new
            {
                errors = result.Errors.Select(e => e.Description)
            });

        var roleResult = await _users.AddToRoleAsync(
            user, "Customer");

        if (!roleResult.Succeeded)
        {
            await _users.DeleteAsync(user);
            return StatusCode(500, new
            {
                message = "Could not assign customer role."
            });
        }

        await _signIn.SignInAsync(user, isPersistent: false);

        return Ok(new
        {
            message = "Account created",
            user.Id,
            user.Email,
            role = "Customer"
        });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        var result = await _signIn.PasswordSignInAsync(
            request.Email.Trim(),
            request.Password,
            isPersistent: false,
            lockoutOnFailure: true);

        if (!result.Succeeded)
            return Unauthorized(new
            {
                message = "Invalid credentials or account locked."
            });

        return Ok(new { message = "Logged in" });
    }

    [Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await _signIn.SignOutAsync();

        return Ok(new { message = "Logged out" });
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        var user = await _users.GetUserAsync(User);

        if (user == null)
            return Unauthorized();

        var roles = await _users.GetRolesAsync(user);

        return Ok(new
        {
            user.Id,
            user.Email,
            roles
        });
    }
}


public record RegisterRequest(
    [param: Required, EmailAddress] string Email,
    [param: Required] string Password);

public record LoginRequest(
    [param: Required, EmailAddress] string Email,
    [param: Required] string Password);
