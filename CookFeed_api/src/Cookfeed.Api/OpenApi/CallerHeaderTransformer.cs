using System.Reflection;
using Cookfeed.Api.Binding;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;

namespace Cookfeed.Api.OpenApi;

/// <summary>
/// Describes the <c>X-User-Id</c> caller header in the OpenAPI document. The generator sees a header parameter but
/// not what <see cref="CallerIdModelBinder"/> enforces, so it would list it as optional everywhere: this marks it
/// required where the action takes an <c>int</c> caller (the <c>/api/me</c> routes) and optional where it takes an
/// <c>int?</c> viewer, and says what the header is for. Replaced by a bearer security scheme with login (BuildLog
/// roadmap item 12).
/// </summary>
internal sealed class CallerHeaderTransformer : IOpenApiOperationTransformer
{
    public Task TransformAsync(OpenApiOperation operation, OpenApiOperationTransformerContext context,
        CancellationToken cancellationToken)
    {
        var caller = context.Description.ActionDescriptor.Parameters
            .OfType<ControllerParameterDescriptor>()
            .FirstOrDefault(p => p.ParameterInfo.GetCustomAttribute<FromCallerHeaderAttribute>() is not null);
        var header = operation.Parameters?
            .OfType<OpenApiParameter>()
            .FirstOrDefault(p => p.In == ParameterLocation.Header && p.Name == CallerIdModelBinder.HeaderName);

        if (caller is not null && header is not null)
        {
            // An int caller is required; an int? viewer is optional.
            header.Required = Nullable.GetUnderlyingType(caller.ParameterType) is null;
            header.Description = header.Required
                ? "The caller's user id: a whole number of 1 or more. Required. Stands in for login until JWT " +
                  "authentication lands (roadmap item 12)."
                : "The viewer's user id, if signed in: a whole number of 1 or more. Optional; without it the " +
                  "response is for a signed-out visitor. Stands in for login until JWT authentication lands.";
        }
        return Task.CompletedTask;
    }
}
