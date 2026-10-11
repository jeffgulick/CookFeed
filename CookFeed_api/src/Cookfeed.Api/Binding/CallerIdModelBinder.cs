using System.Globalization;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Cookfeed.Api.Binding;

/// <summary>
/// Reads the caller from the <c>X-User-Id</c> header, the stand-in for login until Assignment 4
/// (DesignDocument.md §9). Every route reads it the same way: a whole number of 1 or more in plain digits.
/// Anything else (0, a negative number, hex, a leading +, an empty or repeated header) is a model error, which
/// [ApiController] turns into a 400 before the action runs. The header is required when the parameter is
/// <c>int</c> (routes under <c>/api/me</c>) and optional when it is <c>int?</c> (the public routes).
/// </summary>
public sealed class CallerIdModelBinder : IModelBinder
{
    public const string HeaderName = "X-User-Id";

    public Task BindModelAsync(ModelBindingContext bindingContext)
    {
        var values = bindingContext.HttpContext.Request.Headers[HeaderName];

        if (values.Count == 0)
        {
            if (bindingContext.ModelType == typeof(int))
            {
                bindingContext.ModelState.TryAddModelError(bindingContext.ModelName,
                    $"The {HeaderName} header is required.");
            }
            else
            {
                bindingContext.Result = ModelBindingResult.Success(null);
            }
            return Task.CompletedTask;
        }

        // NumberStyles.None: digits only, so "0x1" and "+1" are not read as user 1 the way .NET's default
        // integer conversion would read them.
        if (values.Count == 1
            && int.TryParse(values[0], NumberStyles.None, CultureInfo.InvariantCulture, out var userId)
            && userId >= 1)
        {
            bindingContext.Result = ModelBindingResult.Success(userId);
        }
        else
        {
            bindingContext.ModelState.TryAddModelError(bindingContext.ModelName,
                $"The {HeaderName} header must be a whole number of 1 or more, written in digits.");
        }
        return Task.CompletedTask;
    }
}
